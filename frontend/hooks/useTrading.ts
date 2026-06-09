import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useToast } from "../lib/useToast";
import { Session, Launch } from "../types";
import { toNano, nanoToDecimal, calculateExactBuyAmount } from "../lib/utils";
import { BondingCurveAbi, TokenRootAbi, TokenWalletAbi } from "../lib/abi";
import { BondingCurveMethods, TokenRootMethods, TokenWalletMethods, TypedContract } from "../types/contracts";

const TRADE_FEE_BPS = 100; // Hardcoded fallback fee

export function useTrading(session: Session | null, token: Launch | null, onchainPrice: number | null, t: (k: string) => string) {
  const [tradeMode, setTradeModeRaw] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState<string>("");
  const [slippage, setSlippage] = useState("5");
  const [isTrading, setIsTrading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  const [buyReturn, setBuyReturn] = useState<number | null>(null);
  const [sellReturn, setSellReturn] = useState<number | null>(null);

  const { toast } = useToast();
  const router = useRouter();

  const setTradeMode = useCallback((mode: "buy" | "sell") => {
    setTradeModeRaw(mode);
    setBuyReturn(null);
    setSellReturn(null);
  }, []);

  // Separate effect for buy return (binary search) to provide exact amounts and calculate impact
  useEffect(() => {
    if (tradeMode !== "buy" || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setBuyReturn(null);
      return;
    }
    const bcAddress = token?.onchainData?.bondingCurveAddress;
    if (!bcAddress || token.onchainData?.deployStatus !== "deployed") return;
    
    if (!onchainPrice) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const { getEver } = await import('../lib/ever');
        const ever = await getEver();
        const { Address } = await import('everscale-inpage-provider');
        const bcContract = new ever.Contract(BondingCurveAbi, new Address(bcAddress)) as unknown as TypedContract<BondingCurveMethods>;
        
        const { expectedNanoTokens } = await calculateExactBuyAmount(tradeAmount, onchainPrice, null, bcContract);
        
        if (!cancelled && expectedNanoTokens > BigInt("0")) {
            setBuyReturn(Number(expectedNanoTokens) / 1e9);
        } else if (!cancelled) {
            setBuyReturn(0);
        }
      } catch (err) {
        console.warn("Buy estimate failed", err);
      }
    }, 400);

    return () => { 
      cancelled = true; 
      clearTimeout(timeoutId);
    };
  }, [tradeAmount, tradeMode, token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus, onchainPrice]);

  // Separate effect for sell return
  useEffect(() => {
    if (tradeMode !== "sell" || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setSellReturn(null);
      return;
    }
    const bcAddress = token?.onchainData?.bondingCurveAddress;
    if (!bcAddress || token.onchainData?.deployStatus !== "deployed") return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const { getEver } = await import('../lib/ever');
        const ever = await getEver();
        const { Address } = await import('everscale-inpage-provider');
        const bc = new ever.Contract(BondingCurveAbi, new Address(bcAddress)) as unknown as TypedContract<BondingCurveMethods>;
        const tokensToSellNano = toNano(tradeAmount);
        const sellReturnRes = await bc.methods.getSellReturn({ tokenAmount: tokensToSellNano.toString() }).call();
        if (!cancelled && sellReturnRes?.value0) {
          setSellReturn(nanoToDecimal(sellReturnRes.value0) || null);
        }
      } catch {
        // Provider not available
      }
    }, 400);
    return () => { 
      cancelled = true; 
      clearTimeout(timeoutId);
    };
  }, [token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus, tradeMode, tradeAmount]);

  async function handleTrade(currentPrice: number | null) {
    if (!session) return router.push(`/auth?from=/token/${token?.id}`);
    setError("");
    setIsTrading(true);
    
    try {
      if (!token?.onchainData?.bondingCurveAddress) {
        throw new Error("Contrato Bonding Curve não disponível. Aguarde o deploy on-chain.");
      }
      
      const { getEver } = await import('../lib/ever');
      const { Address } = await import('everscale-inpage-provider');
      const ever = await getEver();
      const { accountInteraction } = await ever.requestPermissions({ permissions: ['basic', 'accountInteraction'] });
      if (!accountInteraction) throw new Error(t("error_denied"));

      const rawAmount = parseFloat(tradeAmount);
      if (!tradeAmount || !Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error(t("error_invalid_value"));

      const isBuy = tradeMode === "buy";
      const slippagePct = parseFloat(slippage);

      if (isBuy) {
        if (!currentPrice) throw new Error(t("error_no_price"));

        const bcContract = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress)) as unknown as TypedContract<BondingCurveMethods>;

        const { expectedNanoTokens, baseCostNano } = await calculateExactBuyAmount(tradeAmount, currentPrice, slippagePct, bcContract);
        
        if (expectedNanoTokens === BigInt("0")) throw new Error("Valor muito baixo para comprar ao menos uma fração do token.");

        const feeRes = await bcContract.methods.getTradeFeeBps({}).call();
        const currentFeeBps = BigInt(feeRes.value0 || TRADE_FEE_BPS);

        const finalBaseCostNano = baseCostNano;
        const finalFeeNano = (finalBaseCostNano * currentFeeBps) / BigInt("10000");
        const mintGasShell = BigInt(6 * 10**9); // 6 SHELL for AFT minting
        const maxShellNano = finalBaseCostNano + finalFeeNano + mintGasShell;

        const tx = await bcContract.methods.buy({
          tokenAmount: expectedNanoTokens.toString(),
          maxShellIn: maxShellNano.toString()
        }).send({
          from: accountInteraction.address,
          amount: "500000000",
          bounce: true,
          currencies: { 2: maxShellNano.toString() }
        } as any);
        
        setTradeSuccess(`${t("success_buy")} ${tx?.transaction?.id?.hash || 'confirmada'}`);
        toast.success(t("common_success"), `${t("success_buy")} ${tx?.transaction?.id?.hash?.slice(0,8) || 'confirmada'}`);
      } else {
        if (!token?.onchainData?.tokenRootAddress) {
          throw new Error("TokenRoot não disponível. Impossível executar sell.");
        }

        const rootContract = new ever.Contract(TokenRootAbi, new Address(token.onchainData.tokenRootAddress)) as unknown as TypedContract<TokenRootMethods>;
        const walletResult = await rootContract.methods.getWalletAddress({
          ownerAddress: accountInteraction.address
        }).call();
        
        const userWalletAddress = walletResult.walletAddress;
        if (!userWalletAddress || userWalletAddress.toString() === "0:0000000000000000000000000000000000000000000000000000000000000000") {
          throw new Error(t("error_no_wallet"));
        }

        const balance = await ever.getBalance(accountInteraction.address);
        const balanceNano = BigInt(balance || "0");
        if (balanceNano < 500000000n) {
          throw new Error(t("error_no_balance_gas"));
        }

        if (!currentPrice) {
          throw new Error(t("error_no_price"));
        }
        const grossReturnForSlippage = sellReturn !== null ? toNano(String(sellReturn)) : BigInt("0");
        if (grossReturnForSlippage === BigInt("0")) {
          throw new Error(t("error_sell_return"));
        }
        const minShellOutNano = grossReturnForSlippage * BigInt(Math.round(100 - slippagePct)) / BigInt("100");

        const walletContract = new ever.Contract(TokenWalletAbi, userWalletAddress) as unknown as TypedContract<TokenWalletMethods>;
        const tokensToSellNano = toNano(tradeAmount);
        
        // Encode minShellOut in the forward payload for slippage protection during the sell
        const packed = await ever.packIntoCell({
          structure: [{ name: 'minShellOut', type: 'uint128' }] as const,
          data: { minShellOut: minShellOutNano.toString() }
        });
        const payloadCell = packed.boc;

        // TEP-74 Transfer: User transfers tokens to BondingCurve, which triggers onAFTTransfer
        const tx = await walletContract.methods.transfer({
          queryId: "0",
          amount: tokensToSellNano.toString(),
          destinationOwner: new Address(token.onchainData.bondingCurveAddress),
          responseDestination: accountInteraction.address,
          customPayload: null, // No custom payload
          forwardShellAmount: "2000000000", // 2 SHELL for gas execution in the bonding curve
          forwardPayload: payloadCell
        }).send({
          from: accountInteraction.address,
          amount: "500000000", // 0.5 VMSHELL for execution
          bounce: true,
          currencies: { 2: "2500000000" } // 2.5 SHELL (0.5 for AFTWallet execution + 2.0 to forward to BC)
        } as any);
        
        setTradeSuccess(t("success_sell") || `Venda realizada com sucesso!`);
        toast.success(t("common_success"), "Tokens queimados e SHELL enviado!");
      }
    } catch(err) {
      setTradeSuccess("");
      toast.error(t("common_error") || "Falha no Trade", (err as Error).message || "Ocorreu um erro na transação.");
    } finally {
      setIsTrading(false);
    }
  }

  return {
    tradeMode, setTradeMode,
    tradeAmount, setTradeAmount,
    slippage, setSlippage,
    isTrading, tradeSuccess, error,
    buyReturn, sellReturn,
    handleTrade, TRADE_FEE_BPS
  };
}
