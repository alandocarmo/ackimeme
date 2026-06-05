import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getLaunchById, getSession, getComments, postComment, getSocket } from "../../lib/api";
import { BondingCurveAbi, TokenWalletAbi, TokenRootAbi } from "../../lib/abi";
import { useToast } from "../../lib/useToast";
import { formatNum, getSlopeLabel, formatSupply, compactWallet, isSafeUrl, formatDate, toNano, nanoToDecimal, calculateExactBuyAmount, hashColor, calcBondingStats } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import styles from "../../styles/Token.module.css";
import type { Session, Launch, CommentType, Trade, Holder, OnchainData } from "../../types";

// Removed duplicated functions

import { PriceChart } from "../../components/PriceChart";
import { BubbleMap } from "../../components/BubbleMap";
import { TradingChart } from "../../components/TradingChart";
import { TokenHeader } from "../../components/token/TokenHeader";
import { TokenChat } from "../../components/token/TokenChat";
import { TokenTradingPanel } from "../../components/token/TokenTradingPanel";
import { SEO } from "../../components/SEO";
import { Skeleton } from "../../components/ui/Skeleton";


const TRADE_FEE_BPS = 100; // 1% total fee — matches BondingCurve.sol constant

// Local getSlopeLabel removed, using shared utility

export default function TokenPage(): React.JSX.Element {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = router.query;
  const idStr = Array.isArray(id) ? id[0] : id as string;
  const [token, setToken] = useState<Launch | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const { toast, ToastContainer } = useToast();

  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [chartTab, setChartTab] = useState<string>("theory"); // theory | live
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<number>(15);

  // M2 FIX: wrap setTradeMode to clear stale messages
  const [tradeMode, _setTradeMode] = useState<string>("buy");
  function setTradeMode(mode: string) {
    _setTradeMode(mode);
    setError("");
    setTradeSuccess("");
    setTradeAmount("");
  }
  const [tradeAmount, setTradeAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<string>("2");
  const [isTrading, setIsTrading] = useState<boolean>(false);
  const [tradeSuccess, setTradeSuccess] = useState<string>("");
  const [onchainPrice, setOnchainPrice] = useState<number | null>(null); // from getter
  const [sellReturn, setSellReturn] = useState<number | null>(null); // specific for tradeAmount
  const [buyReturn, setBuyReturn] = useState<number | null>(null); // specific for tradeAmount

  // Balances for quick trade %
  const [userShellEccBalance, setUserShellEccBalance] = useState<number | null>(null);
  const [userTokenBalance, setUserTokenBalance] = useState<number | null>(null);

  // A6 FIX: Memoize estimate to prevent recalculation on every render
  const memoizedEstimate = useMemo(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      return { value: "0.00", fee: null, impact: null };
    }
    
    if (tradeMode === "buy") {
      const tokensOut = buyReturn !== null ? buyReturn : 0;
      let impact = null;
      if (onchainPrice && onchainPrice > 0) {
         // spot value of tokens expected vs actual value
         const expectedTokensWithoutImpact = parseFloat(tradeAmount) / onchainPrice;
         if (expectedTokensWithoutImpact > 0) {
           impact = Math.max(0, ((expectedTokensWithoutImpact - tokensOut) / expectedTokensWithoutImpact) * 100);
         }
      }
      return { 
        value: tokensOut > 0 ? tokensOut.toFixed(2) : "aguardando...", 
        fee: (parseFloat(tradeAmount) * 0.01).toFixed(4),
        impact 
      };
    } else {
      const shellOut = sellReturn !== null ? sellReturn : 0;
      let impact = null;
      if (onchainPrice && onchainPrice > 0) {
         // spot value vs actual
         const expectedShellWithoutImpact = parseFloat(tradeAmount) * onchainPrice;
         if (expectedShellWithoutImpact > 0) {
           impact = Math.max(0, ((expectedShellWithoutImpact - shellOut) / expectedShellWithoutImpact) * 100);
         }
      }
      return { 
        value: shellOut > 0 ? shellOut.toFixed(4) : "aguardando...", 
        fee: (shellOut * 0.01).toFixed(4),
        impact 
      };
    }
  }, [tradeAmount, tradeMode, buyReturn, sellReturn, onchainPrice]);

  // Chat/Comments state
  const [comments, setComments] = useState<CommentType[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(1000000000);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then((r) => setSession(r.session)).catch(() => {});
  }, []);

  // Fetch Favorites status for this user
  useEffect(() => {
    if (!session || !idStr) return;
    import("../../lib/api").then(({ getFavorites }) => {
      (getFavorites as any)()
        .then((r: { launches?: import("../../types").Launch[] }) => {
          const favs = r.launches || [];
          setIsFavorite(favs.some((f: import("../../types").Launch) => f.id === idStr));
        })
        .catch(() => {});
    });
  }, [session, idStr]);

  const handleToggleFavorite = useCallback(async () => {
    if (!session) return router.push(`/auth?from=/token/${idStr}`);
    try {
      const { addFavorite, removeFavorite } = await import("../../lib/api");
      if (isFavorite) {
        await removeFavorite(idStr);
        setIsFavorite(false);
        toast.success("Removed", "Removido dos favoritos!");
      } else {
        await addFavorite(idStr);
        setIsFavorite(true);
        toast.success("Added", "Adicionado aos favoritos!");
      }
    } catch (err) {
      toast.error("Erro", (err as Error).message || "Erro ao atualizar favoritos.");
    }
  }, [session, id, isFavorite, toast, router]);

  // Fetch Candlestick Price History
  const fetchPriceHistory = useCallback(() => {
    if (!idStr) return;
    import("../../lib/api").then(({ getPriceHistory }) => {
      getPriceHistory(idStr, selectedInterval)
        .then((r) => {
          setPriceHistory((r as any).history || []);
        })
        .catch((err) => console.error("Error fetching price history", err));
    });
  }, [idStr, selectedInterval]);

  useEffect(() => {
    fetchPriceHistory();
  }, [fetchPriceHistory, trades]);

  const fetchToken = useCallback(() => {
    if (!idStr) return;
    getLaunchById(idStr)
      .then((data) => {
        setToken((data as any).launch);
        setError("");
      })
      .catch((err) => {
        if (String(err.message || "").toLowerCase().includes("404")) {
          setToken(null);
          setError("Token não encontrado.");
        } else {
          setError(err.message || "Falha ao carregar token.");
        }
      })
      .finally(() => setLoading(false));
  }, [idStr]);

  useEffect(() => {
    if (!idStr) return;
    setLoading(true);
    fetchToken();
  }, [idStr, fetchToken]);

  // Fetch on-chain price — defined BEFORE socket effect to avoid temporal dead zone
  const fetchPrice = useCallback(async () => {
    if (!token?.onchainData?.bondingCurveAddress || token!.onchainData!.deployStatus !== "deployed") return;
    
    try {
      const { getEver } = await import('../../lib/ever');
      const ever = await getEver();
      const { Address } = await import('everscale-inpage-provider');

      const bc = new ever.Contract(BondingCurveAbi, new Address(token!.onchainData!.bondingCurveAddress as string));
      
      const buyPriceRes = await (bc.methods as any).getBuyPrice({ tokenAmount: "1000000000" }).call();
      if ((buyPriceRes as any)?.value0) {
        setOnchainPrice(nanoToDecimal(buyPriceRes.value0) || null);
      }
    } catch {
      // Provider not available — use fallback
    }
  }, [token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus]);

  const fetchUserBalances = useCallback(async () => {
    if (!session?.walletAddress) return;
    try {
      // 1. Fetch SHELL ECC balance from backend
      const { getWalletBalance } = await import('../../lib/api');
      const res = await getWalletBalance(session.walletAddress);
      if ((res as any)?.success) {
        setUserShellEccBalance((res as any).shellEccBalance || 0);
      }
      
      // 2. Fetch Token balance directly from contract
      if (token?.onchainData?.tokenRootAddress && token!.onchainData!.deployStatus === "deployed") {
        const { getEver } = await import('../../lib/ever');
        let ever;
        try {
          ever = await getEver();
        } catch(e) { return; }
        const { Address } = await import('everscale-inpage-provider');
        if (ever) {
          const rootContract = new ever.Contract(TokenRootAbi, new Address(token!.onchainData!.tokenRootAddress as string));
          const walletResult = await (rootContract.methods as any).getWalletAddress({ ownerAddress: session.walletAddress }).call();
          const tokenWallet = new ever.Contract(TokenWalletAbi, (walletResult as any).value0);
          const balRes = await (tokenWallet.methods as any).balance({}).call();
          const nanoBal = BigInt((balRes as any).balance);
          const whole = nanoBal / BigInt("1000000000");
          const frac = nanoBal % BigInt("1000000000");
          setUserTokenBalance(Number(`${whole}.${String(frac).padStart(9, "0")}`));
        }
      }
    } catch (err) {
      console.warn("Could not fetch user balances", err);
    }
  }, [session?.walletAddress, token?.onchainData?.tokenRootAddress, token?.onchainData?.deployStatus]);

  useEffect(() => {
    fetchUserBalances();
  }, [fetchUserBalances, tradeSuccess]);

  // C6 FIX: Removed duplicate useEffect for fetchUserBalances

  // Separate effect for buy return (binary search) to provide exact amounts and calculate impact
  useEffect(() => {
    if (tradeMode !== "buy" || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setBuyReturn(null);
      return;
    }
    if (!token?.onchainData?.bondingCurveAddress || token!.onchainData!.deployStatus !== "deployed") return;
    
    if (!onchainPrice) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const { getEver } = await import('../../lib/ever');
        const ever = await getEver();
        const { Address } = await import('everscale-inpage-provider');
        const bcContract = new ever.Contract(BondingCurveAbi, new Address(token!.onchainData!.bondingCurveAddress as string));
        
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

  // Separate effect for sell return — avoids re-registering socket listeners on every keystroke
  useEffect(() => {
    if (tradeMode !== "sell" || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setSellReturn(null);
      return;
    }
    if (!token?.onchainData?.bondingCurveAddress || token!.onchainData!.deployStatus !== "deployed") return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const { getEver } = await import('../../lib/ever');
        const ever = await getEver();
        const { Address } = await import('everscale-inpage-provider');
        const bc = new ever.Contract(BondingCurveAbi, new Address(token!.onchainData!.bondingCurveAddress as string));
        const tokensToSellNano = toNano(tradeAmount);
        const sellReturnRes = await (bc.methods as any).getSellReturn({ tokenAmount: tokensToSellNano.toString() }).call();
        if (!cancelled && (sellReturnRes as any)?.value0) {
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

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  // FE-05: Real-time updates via WebSockets instead of polling
  useEffect(() => {
    if (!idStr) return;
    
    // Initial fetch for comments, trades, and holders
    getComments(idStr).then((r) => setComments(r.comments || [])).catch(() => {});
    import("../../lib/api").then(api => {
      if (api.getTrades) {
        api.getTrades(idStr).then((r) => setTrades(r.trades || [])).catch(() => {});
      }
      if (api.getHolders) {
        api.getHolders(idStr).then((r) => {
          setHolders((r as any).holders || []);
          if ((r as any).totalSupply) setTotalSupply((r as any).totalSupply);
        }).catch(() => {});
      }
    });
    
    const socket = getSocket();
    if (!socket) return;

    socket.emit("join_token", idStr);

    const handleTokenUpdated = (update: Partial<import("../../types").Launch>) => {
      setToken((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: update.status || prev.status,
          onchainData: {
            ...prev.onchainData,
            reserveBalance: update.onchainData?.reserveBalance ?? prev.onchainData?.reserveBalance,
            tokenSupply: update.onchainData?.tokenSupply ?? prev.onchainData?.tokenSupply,
            lockedLiquidity: update.onchainData?.lockedLiquidity ?? prev.onchainData?.lockedLiquidity,
            updatedAt: update.onchainData?.updatedAt ?? prev.onchainData?.updatedAt,
          },
        };
      });
      // Audit #8: Refresh price calculations after reserve update to prevent stale UI
      fetchPrice();
    };

    const handleNewComment = (comment: import("../../types").CommentType) => {
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev;
        return [comment, ...prev];
      });
    };

    let holdersTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleNewTrade = (trade: import("../../types").Trade) => {
      setTrades((prev) => {
        if (prev.find((t) => t.id === trade.id)) return prev;
        return [trade, ...prev];
      });
      // Refresh holders when a trade happens to keep the leaderboard somewhat live
      if (holdersTimeoutId) clearTimeout(holdersTimeoutId);
      holdersTimeoutId = setTimeout(() => {
        import("../../lib/api").then(api => {
          if (api.getHolders) {
            api.getHolders(idStr).then((r) => {
              setHolders((r as any).holders || []);
              if ((r as any).totalSupply) setTotalSupply((r as any).totalSupply);
            }).catch(() => {});
          }
        });
      }, 5000);
    };

    const handleConnect = () => {
      socket.emit("join_token", idStr);
    };

    socket.on("connect", handleConnect);
    socket.on("token_updated", handleTokenUpdated);
    socket.on("new_comment", handleNewComment);
    socket.on("new_trade", handleNewTrade);

    return () => {
      if (holdersTimeoutId) clearTimeout(holdersTimeoutId);
      socket.off("connect", handleConnect);
      socket.off("token_updated", handleTokenUpdated);
      socket.off("new_comment", handleNewComment);
      socket.off("new_trade", handleNewTrade);
    };
  }, [idStr, fetchPrice]);

  const handleCommentPosted = (comment: import("../../types").CommentType) => {
    setComments((prev) => [comment, ...prev]);
  };

  // fetchPrice moved to useCallback above

  // M-06: Don't use misleading fallback price. If on-chain price isn't available,
  // show "awaiting" instead of a 33-million-times-wrong estimate.
  const currentPrice = onchainPrice;

  async function handleTrade() {
    if (!session) return router.push(`/auth?from=/token/${idStr}`);
    setError("");
    setIsTrading(true);
    
    try {
      if (!token?.onchainData?.bondingCurveAddress) {
        throw new Error("Contrato Bonding Curve não disponível. Aguarde o deploy on-chain.");
      }
      
      // Load the Provider Extension
      const { getEver } = await import('../../lib/ever');
      const { Address } = await import('everscale-inpage-provider');
      const ever = await getEver();
      const { accountInteraction } = await ever.requestPermissions({ permissions: ['basic', 'accountInteraction'] });
      if (!accountInteraction) throw new Error(t("error_denied"));

      const rawAmount = parseFloat(tradeAmount);
      // M4 FIX: NaN not caught by <= 0 comparison
      if (!tradeAmount || !Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error(t("error_invalid_value"));

      const isBuy = tradeMode === "buy";
      const rawAmountNano = toNano(tradeAmount);
      const slippagePct = parseFloat(slippage);

      if (isBuy) {
        // R-02: Send SHELL as Extra Currency cc[2], NOT as msg.value (VMSHELL)
        // The BondingCurve.buy() reads payment from msg.currencies[2].
        // msg.value (amount) is used ONLY for gas.
        if (!currentPrice) throw new Error(t("error_no_price"));

        const bcContract = new ever.Contract(BondingCurveAbi, new Address(token!.onchainData!.bondingCurveAddress as string));

        const { expectedNanoTokens, baseCostNano } = await calculateExactBuyAmount(tradeAmount, currentPrice, slippagePct, bcContract);
        
        if (expectedNanoTokens === BigInt("0")) throw new Error("Valor muito baixo para comprar ao menos uma fração do token.");

        const finalBaseCostNano = baseCostNano;
        const finalFeeNano = (finalBaseCostNano * BigInt(TRADE_FEE_BPS)) / BigInt("10000");
        const maxShellNano = finalBaseCostNano + finalFeeNano;


        const tx = await (bcContract.methods as any).buy({
          tokenAmount: expectedNanoTokens.toString(),
          maxShellIn: maxShellNano.toString()
        }).send({
          from: accountInteraction.address,
          amount: "200000000",  // 0.2 SHELL VMSHELL for gas only
          bounce: true,
          // SHELL payment via Extra Currency cc[2] (Acki Nacki Standard)
          currencies: { 2: maxShellNano.toString() }
        });
        setTradeSuccess(`${t("success_buy")} ${(tx as any)?.transaction?.id?.hash || 'confirmada'}`);
        toast.success(t("common_success"), `${t("success_buy")} ${(tx as any)?.transaction?.id?.hash?.slice(0,8) || 'confirmada'}`);
      } else {
        // SELL: Burn tokens via TokenWallet → TokenRoot.notifyBurn → BondingCurve.onTokenBurned
        if (!token?.onchainData?.tokenRootAddress) {
          throw new Error("TokenRoot não disponível. Impossível executar sell.");
        }

        // 1. Resolve user's TokenWallet address
        const rootContract = new ever.Contract(TokenRootAbi, new Address(token!.onchainData!.tokenRootAddress as string));
        const walletResult = await (rootContract.methods as any).getWalletAddress({
          ownerAddress: accountInteraction.address
        }).call();
        
        const userWalletAddress = (walletResult as any).value0;
        if (!userWalletAddress || userWalletAddress.toString() === "0:0000000000000000000000000000000000000000000000000000000000000000") {
          throw new Error(t("error_no_wallet"));
        }

        // 2. M-07: Verify user has enough balance for gas before attempting sell
        const balance = await ever.getBalance(accountInteraction.address);
        const balanceNano = BigInt(balance || "0");
        if (BigInt(balanceNano) < 500000000n) {
          throw new Error(t("error_no_balance_gas"));
        }

        // C5 FIX: Block sell when price is not available (prevents zero slippage)
        if (!currentPrice) {
          throw new Error(t("error_no_price"));
        }
        // 3. Calculate minShellOut for slippage protection
        const grossReturnForSlippage = sellReturn !== null ? toNano(String(sellReturn)) : BigInt("0");
        if (grossReturnForSlippage === BigInt("0")) {
          throw new Error(t("error_sell_return"));
        }
        const minShellOutNano = grossReturnForSlippage * BigInt(Math.round(100 - slippagePct)) / BigInt("100");

        // 4. Call burn on user's TokenWallet, passing BondingCurve as callbackTarget
        const walletContract = new ever.Contract(TokenWalletAbi, new Address(userWalletAddress.toString()));
        
        const tokensToSellNano = toNano(tradeAmount);
        const tx = await (walletContract.methods as any).burn({
          amount: tokensToSellNano.toString(),
          callbackTarget: token!.onchainData!.bondingCurveAddress,
          minShellOut: minShellOutNano.toString()
        }).send({
          from: accountInteraction.address,
          amount: "500000000", // 0.5 SHELL for processing gas
          bounce: true
        });
        setTradeSuccess(`Venda realizada com sucesso!`);
        toast.success("Venda Realizada", "Tokens queimados e SHELL enviado!");
      }
      
    } catch(err) {
      setTradeSuccess("");
      toast.error("Falha no Trade", (err as Error).message || "Ocorreu um erro na transação.");
    } finally {
      setIsTrading(false);
    }
  }

  const stats = token ? calcBondingStats(token.onchainData) : null;
  const color = token ? hashColor(token!.coin?.symbol) : "#888";
  const showMissingTokenCta = Boolean(error) && !loading && !token;

  // Estimate calculation using current price
  // M-06: When price isn't available, show clear indication instead of wrong values
  function getEstimate() {
    const amt = parseFloat(tradeAmount) || 0;
    if (amt <= 0) return { value: "0", fee: null, impact: null };
    if (!currentPrice) return { value: "aguardando preço...", fee: null, impact: null };
    
    let impactPct = 0;
    
    if (tradeMode === "buy") {
      const feeShell = amt * TRADE_FEE_BPS / 10000;
      const expectedFullTokens = buyReturn !== null ? buyReturn : (amt / currentPrice);
      
      // Calculate Price Impact
      if (expectedFullTokens > 0) {
          const executionPrice = (amt - feeShell) / expectedFullTokens;
          impactPct = ((executionPrice - currentPrice) / currentPrice) * 100;
      }
      
      return { 
          value: formatNum(expectedFullTokens.toFixed(2)), 
          fee: feeShell.toFixed(4),
          impact: impactPct
      };
    }
    
    // M-11: Use real sell return from contract if available, otherwise fallback to linear estimate
    const grossReturn = sellReturn !== null ? sellReturn : (amt * currentPrice);
    const fee = grossReturn * TRADE_FEE_BPS / 10000;
    const netReturn = grossReturn - fee;
    
    // Calculate Price Impact
    if (amt > 0) {
        const executionPrice = grossReturn / amt;
        impactPct = ((currentPrice - executionPrice) / currentPrice) * 100;
    }
    
    return { 
        value: formatNum(netReturn.toFixed(4), 4), 
        fee: fee.toFixed(4),
        impact: impactPct
    };
  }

  return (
    <>
      <ToastContainer />
      <SEO 
        title={token ? `$${token.coin.symbol} — ${token.coin.name} | AckiMeme` : "Token | AckiMeme"}
        description={token?.coin?.tagline || "Memecoin on Acki Nacki"}
        image={token?.coin?.logoUrl || "/og-image.jpg"}
      />

      <main className={`page-wrapper container`} style={{ paddingTop: '40px' }}>
        {loading && (
          <Skeleton width="100%" height="400px" borderRadius="16px" style={{ marginBottom: '24px' }} />
        )}
        
        {showMissingTokenCta ? (
          <div className={`card`} style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', marginBottom: '16px' }}>{error}</p>
            <Link href="/" className={`btn-primary`} style={{ padding: '10px 20px', fontSize: '13px' }}>Voltar para o feed</Link>
          </div>
        ) : error ? (
          <p style={{ color: 'var(--red)', textAlign: 'center', padding: '40px' }}>{error}</p>
        ) : null}

        {token && (
          <div className={styles.tokenDetailLayout}>
            {/* Left Column: Info */}
            <div className={styles.detailMain}>
              {/* Header */}
              <TokenHeader token={token!} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />

              {/* GAP-1: Price Chart with Theory / Candlestick Toggles */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '8px' }}>
                    <button
                      onClick={() => setChartTab("theory")}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: chartTab === "theory" ? 'var(--accent)' : 'transparent',
                        color: chartTab === "theory" ? '#000' : 'var(--ink-soft)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {t("detail_bonding_curve") || "Theory Curve"}
                    </button>
                    <button
                      onClick={() => setChartTab("live")}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: chartTab === "live" ? 'var(--accent)' : 'transparent',
                        color: chartTab === "live" ? '#000' : 'var(--ink-soft)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      📈 Price Candles
                    </button>
                  </div>

                  {chartTab === "live" && (
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid var(--ink-faint)' }}>
                      {[5, 15, 60, 1440].map((mins) => {
                        const label = mins === 5 ? "5m" : mins === 15 ? "15m" : mins === 60 ? "1h" : "1d";
                        const active = selectedInterval === mins;
                        return (
                          <button
                            key={mins}
                            onClick={() => setSelectedInterval(mins)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              background: active ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
                              color: active ? 'var(--accent)' : 'var(--ink-soft)',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.1s'
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {chartTab === "theory" ? (
                  <PriceChart 
                    currentPrice={onchainPrice} 
                    progressPct={(stats!.progressPct as string)} 
                    slopeDivisor={token.protocol?.slopeDivisor || 50000} 
                  />
                ) : (
                  <TradingChart history={priceHistory} />
                )}
              </div>

              {/* Bonding Curve Card */}
              {!token.protocol?.pumpForever ? (
                <div className={`card`} style={{ border: '1px solid var(--accent-glow)', background: 'rgba(0, 255, 136, 0.02)' }}>
                  <div className={styles.progressHeader} style={{ marginBottom: '12px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>⬡ Bonding Curve Progress</span>
                    <span className={styles.tokenTime}>Acki Nacki · Fair Launch</span>
                  </div>
                  
                  <div className={styles.progressTrack} style={{ height: '12px', marginBottom: '20px' }}>
                    <div className={styles.progressFill} style={{
                      width: (stats!.progressPct as string) === null ? "0%" : `${(stats!.progressPct as string)}%`,
                      background: parseFloat((stats!.progressPct as string) || "0") > 80
                        ? "linear-gradient(90deg, #f97316, #ef4444)"
                        : "linear-gradient(90deg, #00ff88, #00cc6d)",
                    }} />
                  </div>

                  <div className={styles.tokenStats} style={{ borderTop: 'none', paddingTop: 0, marginBottom: '20px' }}>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>{t("card_progress")}</span>
                      <span className={styles.statValue} style={{ fontSize: '18px' }}>{(stats!.progressPct as string) === null ? "N/A" : `${(stats!.progressPct as string)}%`}</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>{t("card_reserve")}</span>
                      <span className={styles.statValue} style={{ fontSize: '18px' }}>{stats!.hasOnchainReserve ? `${(stats!.reserveShell as number).toFixed(2)} ${t("common_shell")}` : t("info_pending")}</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Threshold</span>
                      <span className={styles.statValue} style={{ fontSize: '18px' }}>69K {t("common_shell")}</span>
                    </div>
                  </div>
                  
                  <p className={styles.tokenSubtitle} style={{ fontSize: '11px', margin: 0, opacity: 0.8 }}>
                    {stats!.hasOnchainReserve
                      ? "Liquidity migrates to internal AMM at 69K SHELL reserve."
                      : "Progress requires reserveBalance indexed from blockchain. Values stay as awaiting until first trade."}
                  </p>
                </div>
              ) : (
                <div className={`card`} style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
                  <div className={styles.progressHeader} style={{ marginBottom: '12px' }}>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>🚀 PUMP FOREVER MODE</span>
                    <span className={styles.tokenTime} style={{ color: '#ef4444' }}>High Risk</span>
                  </div>
                  <p className={styles.tokenSubtitle} style={{ fontSize: '13px', margin: 0, color: 'var(--ink)' }}>
                    This token does <strong>not</strong> graduate to an AMM. Its price will continue to be discovered linearly via the bonding curve forever.
                  </p>
                  <div className={styles.tokenStats} style={{ borderTop: 'none', paddingTop: 0, marginTop: '20px', marginBottom: 0 }}>
                    <div className={styles.statBox} style={{ width: '100%', textAlign: 'center' }}>
                      <span className={styles.statLabel}>Current Reserve</span>
                      <span className={styles.statValue} style={{ fontSize: '24px', color: '#ef4444' }}>{stats!.hasOnchainReserve ? `${(stats!.reserveShell as number).toFixed(2)} SHELL` : "0.00 SHELL"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Deployment Status */}
              <div className={`card`} style={{ border: '1px dashed var(--ink-faint)' }}>
                 <p className={styles.infoLabel}>Blockchain Deployment Status</p>
                 <div className={styles.onchainInfoGrid}>
                    <div className={styles.onchainItem}>
                       <p className={styles.statLabel}>{t("info_status")}</p>
                       <p className={`info-value ${token?.onchainData?.deployStatus === 'deployed' ? 'hero-accent' : ''}`} style={{ fontSize: '13px' }}>
                          {token?.onchainData?.deployStatus?.replace(/_/g, ' ') || 'unknown'}
                       </p>
                    </div>
                    <div className={styles.onchainItem}>
                       <p className={styles.statLabel}>Price</p>
                       <p className={styles.infoValue} style={{ fontSize: '13px' }}>
                          {onchainPrice ? `${onchainPrice.toFixed(9)} ${t("common_shell")}` : t("info_pending")}
                       </p>
                    </div>
                 </div>
                 
                 {token?.onchainData?.deployStatus === 'pending_deployer_configuration' && (
                    <p style={{ color: 'var(--accent-warm)', fontSize: '11px', marginTop: '12px' }}>
                      ⚠️ The system is waiting for the administrative deployer to be funded or configured. 
                      Trading functions are available after on-chain deployment is complete.
                    </p>
                 )}
              </div>

              {/* Info Grid */}
              <div className={styles.infoCardGrid}>
                <div className={styles.infoCard}>
                  <p className={styles.infoLabel}>{t("info_supply")}</p>
                  <p className={styles.infoValue}>{formatSupply(token?.onchainData?.tokenSupply || token!.coin.totalSupply, !!token?.onchainData?.tokenSupply)}</p>
                </div>
                <div className={styles.infoCard}>
                  <p className={styles.infoLabel}>Pump Aggressiveness</p>
                  <p className={styles.infoValue} style={{ color: getSlopeLabel(token.protocol?.slopeDivisor || 50000).color }}>
                    {getSlopeLabel(token.protocol?.slopeDivisor || 50000).label}
                  </p>
                </div>
              </div>
              <div className={styles.infoCardGrid} style={{ marginTop: '16px' }}>
                <div className={styles.infoCard}>
                  <p className={styles.infoLabel}>Risk Profile</p>
                  <p className={styles.infoValue} style={{ color: (token!.riskProfile?.score || 0) > 70 ? 'var(--accent)' : 'var(--accent-warm)' }}>
                    {token!.riskProfile?.score || 0} / {token!.riskProfile?.status || 'Unknown'}
                  </p>
                </div>
                <div className={styles.infoCard}>
                  <p className={styles.infoLabel}>{t("info_creator_rewards")}</p>
                  <p className={styles.infoValue} style={{ fontSize: '13px', lineHeight: 1.4 }}>
                    {t("info_creator_rewards_desc")}
                  </p>
                </div>
              </div>

              {/* About */}
              {token!.coin.description && (
                <div className={`card`}>
                  <p className={styles.infoLabel}>{t("info_about")} {token!.coin.name}</p>
                  <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>{token!.coin.description}</p>
                </div>
              )}

              {/* On-chain Details */}
              <div className={`card`}>
                <p className={styles.infoLabel}>{t("info_onchain")}</p>
                <div className={styles.onchainInfoGrid}>
                  <div className={styles.onchainItem}>
                    <span className={styles.statLabel}>{t("info_ipfs")}</span>
                    {token?.onchainData?.ipfsHash ? (
                      <a href={`https://gateway.pinata.cloud/ipfs/${token.onchainData.ipfsHash}`} target="_blank" rel="noreferrer" className={styles.onchainLink}>
                        {token.onchainData.ipfsHash.slice(0, 10)}...
                      </a>
                    ) : <span className={styles.tokenTime} style={{ display: 'block' }}>{t("info_pending")}</span>}
                  </div>
                  <div className={styles.onchainItem}>
                    <span className={styles.statLabel}>{t("info_token_root")}</span>
                    {token?.onchainData?.tokenRootAddress ? (
                      <a href={`https://beescan.live/accounts/${token!.onchainData!.tokenRootAddress}`} target="_blank" rel="noreferrer" className={styles.onchainLink}>
                        {compactWallet(token!.onchainData!.tokenRootAddress)}
                      </a>
                    ) : <span className={styles.tokenTime} style={{ display: 'block' }}>{t("info_pending")}</span>}
                  </div>
                  <div className={styles.onchainItem}>
                    <span className={styles.statLabel}>{t("info_bonding_curve")}</span>
                    {token?.onchainData?.bondingCurveAddress ? (
                      <a href={`https://beescan.live/accounts/${token!.onchainData!.bondingCurveAddress}`} target="_blank" rel="noreferrer" className={styles.onchainLink}>
                        {compactWallet(token!.onchainData!.bondingCurveAddress)}
                      </a>
                    ) : <span className={styles.tokenTime} style={{ display: 'block' }}>{t("info_pending")}</span>}
                  </div>
                </div>
              </div>

              {/* Links */}
              {(token.links?.website || token.links?.xUrl || token.links?.telegramUrl) && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {token.links.website && <a href={token.links.website} target="_blank" rel="noreferrer" className={`filter-btn`}>🌐 Website</a>}
                  {token.links.xUrl && <a href={token.links.xUrl} target="_blank" rel="noreferrer" className={`filter-btn`}>𝕏 Twitter</a>}
                  {token.links.telegramUrl && <a href={token.links.telegramUrl} target="_blank" rel="noreferrer" className={`filter-btn`}>✈ Telegram</a>}
                </div>
              )}

              {/* Trade History Tape */}
              <div className={`card`} style={{ marginTop: '24px' }}>
                <p className={styles.infoLabel} style={{ marginBottom: '16px' }}>{t("trades_title")}</p>
                <div className={`trade-tape`} style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trades.length === 0 ? (
                    <p className={styles.tokenTime} style={{ textAlign: 'center', padding: '20px' }}>{t("trades_empty")}</p>
                  ) : (
                    trades.map((trade) => (
                      <div key={trade.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'var(--bg-deep)', borderRadius: '6px', borderLeft: `4px solid ${trade.type === 'buy' ? '#10b981' : '#ef4444'}` }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ color: trade.type === 'buy' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', width: '40px' }}>{trade.type}</span>
                          <span style={{ fontSize: '12px', color: hashColor(trade.walletAddress) }}>{compactWallet(trade.walletAddress)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>{formatNum(nanoToDecimal(trade.tokenAmount).toFixed(2))} {token!.coin?.symbol}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-soft)' }}>{nanoToDecimal(trade.shellAmount).toFixed(4)} SHELL</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Holders Leaderboard */}
              <div className={`card`} style={{ marginTop: '24px' }}>
                <p className={styles.infoLabel} style={{ marginBottom: '16px' }}>{t("holders_title")}</p>
                <BubbleMap holders={holders} totalSupply={totalSupply} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {holders.length === 0 ? (
                    <p className={styles.tokenTime} style={{ textAlign: 'center', padding: '20px' }}>{t("holders_empty")}</p>
                  ) : (
                    holders.map((h, idx) => {
                      const pct = (h.balance / totalSupply) * 100;
                      return (
                        <div key={idx} style={{ position: 'relative', background: 'var(--bg-deep)', borderRadius: '6px', padding: '8px', overflow: 'hidden' }}>
                          {/* Barra de Progresso no fundo */}
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: h.isBondingCurve ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', zIndex: 0 }}></div>
                          
                          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--ink-soft)', width: '20px' }}>#{idx + 1}</span>
                              <span style={{ fontSize: '13px', color: h.isBondingCurve ? '#3b82f6' : hashColor(h.walletAddress), fontWeight: h.isBondingCurve ? 'bold' : 'normal' }}>
                                {h.isBondingCurve ? t("holders_bonding_curve") : compactWallet(h.walletAddress)}
                              </span>
                              {h.walletAddress === token.walletAddress && !h.isBondingCurve && (
                                <span style={{ fontSize: '10px', background: 'var(--accent-warm)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{t("holders_creator_badge")}</span>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>{pct.toFixed(2)}%</span>
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--ink-soft)' }}>{formatNum((h.balance / 1e9).toFixed(0))}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Chat / Comments Section */}
              <TokenChat 
                launchId={idStr} 
                comments={comments} 
                session={session} 
                onCommentPosted={handleCommentPosted} 
              />
            </div>

            {/* Right Column: Trade Widget */}
            <TokenTradingPanel
              token={token!}
              session={session}
              tradeMode={tradeMode}
              setTradeMode={setTradeMode}
              tradeAmount={tradeAmount}
              setTradeAmount={setTradeAmount}
              slippage={slippage}
              setSlippage={setSlippage}
              isTrading={isTrading}
              onTrade={handleTrade}
              tradeSuccess={tradeSuccess}
              userShellEccBalance={userShellEccBalance}
              userTokenBalance={userTokenBalance}
              onchainPrice={onchainPrice}
              estimate={memoizedEstimate as any}
            />

          </div>
        )}
      </main>
    </>
  );
}
