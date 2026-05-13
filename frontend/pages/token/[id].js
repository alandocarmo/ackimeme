import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { getLaunchById, getSession, getComments, postComment, socket } from "../../lib/api";
import { BondingCurveAbi, TokenWalletAbi, TokenRootAbi } from "../../lib/abi";
import { useToast } from "../../lib/useToast";
import { formatNum, getSlopeLabel } from "../../lib/utils";

function compactWallet(w) {
  const s = String(w || "");
  return s.length <= 14 ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Redefined using the shared utility

function formatSupply(val, isNano = false) {
  let n = Number(String(val || "0").replace(/[.,]/g, ""));
  if (isNano) n = n / 1e9;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function PriceChart({ currentPrice, progressPct, slopeDivisor }) {
  const points = [];
  const pct = parseFloat(progressPct || "0");
  
  // M-10: Reflect actual slope in the theoretical chart curve
  const baseSlope = 10_000_000_000_000;
  const currentSlope = Number(slopeDivisor || baseSlope);
  const intensity = baseSlope / currentSlope; // Suave=0.5x, Normal=1x, Insane=10x
  const exponent = 1.4 + (intensity * 0.2); // Dynamic exponent for visual steepness

  for (let i = 0; i <= 40; i++) {
     const x = (i / 40) * 100;
     const y = 70 - (Math.pow(i / 40, exponent) * 50); 
     points.push(`${x},${y}`);
  }
  
  const currentX = pct;
  const currentY = 70 - (Math.pow(pct / 100, exponent) * 50);

  return (
    <div className="card chart-card" style={{ height: '240px', padding: '0', position: 'relative', overflow: 'hidden', border: '1px solid var(--ink-faint)', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,255,136,0.02) 100%)' }}>
       <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
          <p className="info-label" style={{ margin: 0, fontSize: '10px' }}>BONDING CURVE (THEORETICAL MODEL)</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            {currentPrice ? `${currentPrice.toFixed(9)}` : '---'} <span style={{ fontSize: '12px', fontWeight: 400 }}>SHELL</span>
          </p>
       </div>
       
       <svg viewBox="0 0 100 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Grid lines */}
          <line x1="0" y1="20" x2="100" y2="20" stroke="var(--ink-faint)" strokeWidth="0.1" />
          <line x1="0" y1="45" x2="100" y2="45" stroke="var(--ink-faint)" strokeWidth="0.1" />
          
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.join(' ')}
            style={{ filter: 'url(#glow)' }}
          />
          <path
            d={`M 0 80 L ${points.join(' L ')} L 100 80 Z`}
            fill="url(#chartGradient)"
          />
          
          <circle 
            cx={currentX} 
            cy={currentY} 
            r="1.2" 
            fill="var(--bg)"
            stroke="var(--accent)"
            strokeWidth="0.5"
            style={{ filter: 'drop-shadow(0 0 5px var(--accent))' }}
          />
       </svg>
       
       <div style={{ position: 'absolute', bottom: '10px', right: '15px', color: 'var(--ink-soft)', fontSize: '10px' }}>
         Bonding Curve: {pct}%
       </div>
    </div>
  );
}

/** Nano to decimal (9 decimals standard in TVM/SHELL) */
function nanoToDecimal(nano) {
  const val = BigInt(String(nano || "0").replace(/\D/g, "") || "0");
  const whole = val / 1_000_000_000n;
  const frac = val % 1_000_000_000n;
  return Number(`${whole}.${String(frac).padStart(9, "0")}`);
}

/** Helper to convert decimal string to BigInt nano (9 decimals) avoiding float imprecision */
// Audit #19: Hardened against scientific notation (e.g. "1e-7") which breaks BigInt()
function toNano(valStr) {
  const num = parseFloat(valStr);
  if (!valStr || !Number.isFinite(num) || num < 0) return 0n;
  // Use toFixed to normalize scientific notation to decimal string
  const fixed = num.toFixed(9);
  const [whole = "0", frac = ""] = fixed.split(".");
  const fracPad = frac.padEnd(9, "0").slice(0, 9);
  return BigInt(whole) * 1_000_000_000n + BigInt(fracPad || "0");
}


const MIGRATION_THRESHOLD_NANO = 15_000_000_000_000; // 15K SHELL in nano
const TRADE_FEE_BPS = 100; // 1% total fee — matches BondingCurve.sol constant

function readReserveBalance(onchainData) {
  const parsed = Number(onchainData?.reserveBalance);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function calcBondingStats(onchainData) {
  const reserveBalance = readReserveBalance(onchainData);
  const hasOnchainReserve = Number.isFinite(reserveBalance);
  const progressPct = hasOnchainReserve
    ? Math.min((reserveBalance / MIGRATION_THRESHOLD_NANO) * 100, 100).toFixed(1)
    : null;
  const reserveShell = hasOnchainReserve ? reserveBalance / 1e9 : null;

  return { reserveBalance, reserveShell, hasOnchainReserve, progressPct };
}

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Local getSlopeLabel removed, using shared utility

export default function TokenPage() {
  const router = useRouter();
  const { id } = router.query;
  const [token, setToken] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast, ToastContainer } = useToast();

  const [tradeMode, setTradeMode] = useState("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [isTrading, setIsTrading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState("");
  const [onchainPrice, setOnchainPrice] = useState(null); // from getter
  const [sellReturn, setSellReturn] = useState(null); // specific for tradeAmount

  // Balances for quick trade %
  const [userShellEccBalance, setUserShellEccBalance] = useState(null);
  const [userTokenBalance, setUserTokenBalance] = useState(null);

  // Chat/Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then(r => setSession(r.session)).catch(() => {});
  }, []);

  const fetchToken = useCallback(() => {
    if (!id) return;
    getLaunchById(id)
      .then((data) => {
        setToken(data.launch);
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
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchToken();
  }, [id, fetchToken]);

  // Fetch on-chain price — defined BEFORE socket effect to avoid temporal dead zone
  const fetchPrice = useCallback(async () => {
    if (!token?.onchainData?.bondingCurveAddress || token.onchainData.deployStatus !== "deployed") return;
    
    try {
      const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
      const ever = new ProviderRpcClient();
      if (!(await ever.hasProvider())) return;
      await ever.ensureInitialized();

      const bc = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress));
      
      const buyPriceRes = await bc.methods.getBuyPrice({ tokenAmount: "1000000000" }).call();
      if (buyPriceRes?.value0) {
        setOnchainPrice(nanoToDecimal(buyPriceRes.value0));
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
      if (res?.success) {
        setUserShellEccBalance(res.shellEccBalance || 0);
      }
      
      // 2. Fetch Token balance directly from contract
      if (token?.onchainData?.tokenRootAddress && token.onchainData.deployStatus === "deployed") {
        const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
        const ever = new ProviderRpcClient();
        if (await ever.hasProvider()) {
          await ever.ensureInitialized();
          const rootContract = new ever.Contract(TokenRootAbi, new Address(token.onchainData.tokenRootAddress));
          const walletResult = await rootContract.methods.getWalletAddress({ ownerAddress: session.walletAddress, answerId: 0 }).call();
          const tokenWallet = new ever.Contract(TokenWalletAbi, walletResult.value0);
          const balRes = await tokenWallet.methods.balance({ answerId: 0 }).call();
          const nanoBal = BigInt(balRes.value0);
          const whole = nanoBal / 1_000_000_000n;
          const frac = nanoBal % 1_000_000_000n;
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

  // Separate effect for sell return — avoids re-registering socket listeners on every keystroke
  useEffect(() => {
    if (tradeMode !== "sell" || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setSellReturn(null);
      return;
    }
    if (!token?.onchainData?.bondingCurveAddress || token.onchainData.deployStatus !== "deployed") return;

    let cancelled = false;
    (async () => {
      try {
        const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
        const ever = new ProviderRpcClient();
        if (!(await ever.hasProvider())) return;
        await ever.ensureInitialized();
        const bc = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress));
        const tokensToSellNano = toNano(tradeAmount);
        const sellReturnRes = await bc.methods.getSellReturn({ tokenAmount: tokensToSellNano.toString() }).call();
        if (!cancelled && sellReturnRes?.value0) {
          setSellReturn(nanoToDecimal(sellReturnRes.value0));
        }
      } catch {
        // Provider not available
      }
    })();
    return () => { cancelled = true; };
  }, [token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus, tradeMode, tradeAmount]);

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  // FE-05: Real-time updates via WebSockets instead of polling
  useEffect(() => {
    if (!id) return;
    
    // Initial fetch for comments
    getComments(id).then(r => setComments(r.comments || [])).catch(() => {});
    
    if (!socket) return;

    socket.emit("join_token", id);

    const handleTokenUpdated = (update) => {
      setToken((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: update.status,
          onchainData: {
            ...prev.onchainData,
            reserveBalance: update.reserveBalance,
            tokenSupply: update.tokenSupply,
            lockedLiquidity: update.lockedLiquidity,
            updatedAt: update.updatedAt,
          },
        };
      });
      // Audit #8: Refresh price calculations after reserve update to prevent stale UI
      fetchPrice();
    };

    const handleNewComment = (comment) => {
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev;
        return [comment, ...prev];
      });
    };

    socket.on("token_updated", handleTokenUpdated);
    socket.on("new_comment", handleNewComment);

    return () => {
      socket.off("token_updated", handleTokenUpdated);
      socket.off("new_comment", handleNewComment);
    };
  }, [id, fetchPrice]);

  async function handlePostComment(e) {
    e.preventDefault();
    if (!session) return router.push(`/auth?from=/token/${id}`);
    if (!newComment.trim() || isPosting) return;

    setIsPosting(true);
    try {
      const res = await postComment(id, newComment);
      setComments((prev) => [res.comment, ...prev]);
      setNewComment("");
      toast.success("Success", "Comentário postado com sucesso!");
    } catch (err) {
      toast.error("Erro", err.message || "Erro ao postar comentário.");
    } finally {
      setIsPosting(false);
    }
  }

  // fetchPrice moved to useCallback above

  // M-06: Don't use misleading fallback price. If on-chain price isn't available,
  // show "awaiting" instead of a 33-million-times-wrong estimate.
  const currentPrice = onchainPrice;

  async function handleTrade() {
    if (!session) return router.push(`/auth?from=/token/${id}`);
    setError("");
    setIsTrading(true);
    
    try {
      if (!token?.onchainData?.bondingCurveAddress) {
        throw new Error("Contrato Bonding Curve não disponível. Aguarde o deploy on-chain.");
      }
      
      // Load the Provider Extension
      const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
      const ever = new ProviderRpcClient();
      if (!(await ever.hasProvider())) throw new Error("Instale a extensão Acki Nacki / EVER Wallet.");
      
      await ever.ensureInitialized();
      const { accountInteraction } = await ever.requestPermissions({ permissions: ['basic', 'accountInteraction'] });
      if (!accountInteraction) throw new Error("Conexão com a carteira negada.");

      const rawAmount = parseFloat(tradeAmount);
      if (!tradeAmount || rawAmount <= 0) throw new Error("Valor inválido.");

      const isBuy = tradeMode === "buy";
      const slippagePct = parseFloat(slippage);

      if (isBuy) {
        // R-02: Send SHELL as Extra Currency cc[2], NOT as msg.value (VMSHELL)
        // The BondingCurve.buy() reads payment from msg.currencies[2].
        // msg.value (amount) is used ONLY for gas.
        if (!currentPrice) throw new Error("Preço ainda não disponível. Aguarde sync on-chain.");

        const bcContract = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress));

        // C-08: Binary search to find the exact max tokenAmount we can buy for rawAmountNano (including 1% fee).
        // Since getBuyPrice in TVM requires tokenAmount as input, we can't just pass maxShellIn.
        // We know: maxShellIn = cost + (cost * 1 / 100) = cost * 101 / 100.
        // So base_cost_max = rawAmountNano * 100 / 101.
        const maxBaseCostNano = (rawAmountNano * 100n) / 101n;
        
        let low = 0n;
        let high = rawAmountNano * 100000000n; // arbitrary high upper bound (assumes price > 0.00001)
        let expectedNanoTokens = 0n;
        let baseCostNano = 0n;

        // Fast estimation to narrow the bounds using spot price
        const currentPriceNano = toNano(String(currentPrice));
        if (currentPriceNano > 0n) {
           const spotEst = (maxBaseCostNano * 1000000000n) / currentPriceNano;
           // The real cost on a bonding curve is higher than spot, so spotEst is an upper bound
           high = spotEst;
           low = spotEst / 2n; // start with half
        }

        // Binary search for exact token amount (up to 25 iterations for precision)
        for (let i = 0; i < 25; i++) {
            const mid = (low + high) / 2n;
            if (mid === 0n) break;
            
            try {
                const costResult = await bcContract.methods.getBuyPrice({ tokenAmount: mid.toString() }).call();
                const cost = BigInt(costResult.value0);
                
                if (cost <= maxBaseCostNano) {
                    expectedNanoTokens = mid;
                    baseCostNano = cost;
                    low = mid + 1n;
                } else {
                    high = mid - 1n;
                }
            } catch (err) {
                // If the curve calculation fails (e.g. overflow), we must lower our guess
                high = mid - 1n;
            }
        }

        if (expectedNanoTokens === 0n) throw new Error("Valor muito baixo para comprar ao menos uma fração do token.");

        // Apply slippage downwards (we already guarantee we won't exceed user's SHELL input)
        // If slippage is 5%, we accept receiving 5% FEWER tokens than the optimal expected.
        expectedNanoTokens = expectedNanoTokens * BigInt(Math.round(100 - slippagePct)) / 100n;

        // Re-calculate the exact cost for this final discounted token amount to send the right payment
        const finalCostResult = await bcContract.methods.getBuyPrice({ tokenAmount: expectedNanoTokens.toString() }).call();
        const finalBaseCostNano = BigInt(finalCostResult.value0);
        const finalFeeNano = (finalBaseCostNano * BigInt(TRADE_FEE_BPS)) / 10000n;
        const maxShellNano = finalBaseCostNano + finalFeeNano;


        const tx = await bcContract.methods.buy({
          tokenAmount: expectedNanoTokens.toString(),
          maxShellIn: maxShellNano.toString()
        }).send({
          from: accountInteraction.address,
          amount: "200000000",  // 0.2 SHELL VMSHELL for gas only
          bounce: true,
          // SHELL payment via Extra Currency cc[2] (Acki Nacki Standard)
          currencies: { 2: maxShellNano.toString() }
        });
        setTradeSuccess(`Compra realizada com sucesso! Tx: ${tx?.transaction?.id?.hash || 'confirmada'}`);
        toast.success("Compra Realizada", `Sucesso! Tx: ${tx?.transaction?.id?.hash?.slice(0,8) || 'confirmada'}`);
      } else {
        // SELL: Burn tokens via TokenWallet → TokenRoot.notifyBurn → BondingCurve.onTokenBurned
        if (!token?.onchainData?.tokenRootAddress) {
          throw new Error("TokenRoot não disponível. Impossível executar sell.");
        }

        // 1. Resolve user's TokenWallet address
        const rootContract = new ever.Contract(TokenRootAbi, new Address(token.onchainData.tokenRootAddress));
        const walletResult = await rootContract.methods.getWalletAddress({
          ownerAddress: accountInteraction.address
        }).call();
        
        const userWalletAddress = walletResult.value0;
        if (!userWalletAddress || userWalletAddress.toString() === "0:0000000000000000000000000000000000000000000000000000000000000000") {
          throw new Error("Você não possui uma TokenWallet para este token. Compre tokens primeiro.");
        }

        // 2. M-07: Verify user has enough balance for gas before attempting sell
        const balance = await ever.getBalance(accountInteraction.address);
        const balanceNano = BigInt(balance || "0");
        const gasNeeded = BigInt("500000000"); // 0.5 SHELL
        if (balanceNano < gasNeeded) {
          throw new Error(`Saldo insuficiente para gas. Precisa de pelo menos 0.5 SHELL na carteira. Saldo atual: ${Number(balanceNano) / 1e9} SHELL.`);
        }

        // 3. Calculate minShellOut for slippage protection
        const estimate = getEstimate();
        const expectedNetShell = toNano(estimate.value);
        const minShellOutNano = expectedNetShell * BigInt(Math.round(100 - slippagePct)) / 100n;

        // 4. Call burn on user's TokenWallet, passing BondingCurve as callbackTarget
        const walletContract = new ever.Contract(TokenWalletAbi, new Address(userWalletAddress.toString()));
        
        const tokensToSellNano = toNano(tradeAmount);
        const tx = await walletContract.methods.burn({
          amount: tokensToSellNano.toString(),
          callbackTarget: token.onchainData.bondingCurveAddress,
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
      setError(err.message || "Erro durante o trade.");
      toast.error("Falha no Trade", err.message || "Ocorreu um erro na transação.");
    } finally {
      setIsTrading(false);
    }
  }

  const stats = token ? calcBondingStats(token.onchainData) : null;
  const color = token ? hashColor(token.coin?.symbol) : "#888";
  const showMissingTokenCta = Boolean(error) && !loading && !token;

  // Estimate calculation using current price
  // M-06: When price isn't available, show clear indication instead of wrong values
  function getEstimate() {
    const amt = parseFloat(tradeAmount) || 0;
    if (amt <= 0) return { value: "0", fee: null };
    if (!currentPrice) return { value: "aguardando preço...", fee: null };
    
    if (tradeMode === "buy") {
      const expectedFullTokens = amt / currentPrice;
      const feeShell = amt * TRADE_FEE_BPS / 10000;
      return { value: formatNum(expectedFullTokens.toFixed(2)), fee: feeShell.toFixed(4) };
    }
    
    // M-11: Use real sell return from contract if available, otherwise fallback to linear estimate
    const grossReturn = sellReturn !== null ? sellReturn : (amt * currentPrice);
    const fee = grossReturn * TRADE_FEE_BPS / 10000;
    const netReturn = grossReturn - fee;
    return { value: netReturn.toFixed(9), fee: fee.toFixed(4) };
  }

  return (
    <>
      <ToastContainer />
      <Head>
        <title>{token ? `$${token.coin.symbol} — ${token.coin.name}` : "Token"} | AckiMeme</title>
        <meta name="description" content={token?.coin?.tagline || "Memecoin on Acki Nacki"} />
      </Head>

      <main className="page-wrapper container" style={{ paddingTop: '40px' }}>
        {loading && <p className="token-time" style={{ textAlign: 'center', fontSize: '14px' }}>Loading token data...</p>}
        
        {showMissingTokenCta ? (
          <div className="card" style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', marginBottom: '16px' }}>{error}</p>
            <Link href="/" className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>Voltar para o feed</Link>
          </div>
        ) : error ? (
          <p style={{ color: 'var(--red)', textAlign: 'center', padding: '40px' }}>{error}</p>
        ) : null}

        {token && (
          <div className="token-detail-layout">
            {/* Left Column: Info */}
            <div className="detail-main">
              {/* Header */}
              <div className="token-header-section">
                <div className="token-avatar" style={{
                  width: '80px',
                  height: '80px',
                  background: `linear-gradient(135deg, ${color}, ${color}44)`,
                  fontSize: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '16px'
                }}>
                  {isSafeUrl(token.coin?.logoUrl) ? (
                    <img src={token.coin.logoUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />
                  ) : (
                    <span style={{ color: '#fff', fontWeight: 700 }}>
                      {(token.coin?.symbol || "?")[0]}
                    </span>
                  )}
                </div>
                <div className="token-title-info">
                  <h1 className="token-main-title">{token.coin.name}</h1>
                  <span className="token-ticker">${token.coin.symbol}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div className="status-badge">{token.status.replace(/_/g, " ")}</div>
                  <button 
                    onClick={() => {
                      const shareText = `Check out $${token.coin.symbol} on AckiMeme! 🚀`;
                      const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
                    }}
                    style={{
                      background: 'rgba(0, 136, 204, 0.1)',
                      color: '#0088cc',
                      border: '1px solid rgba(0, 136, 204, 0.2)',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Share
                  </button>
                </div>
              </div>

              {/* GAP-1: Price Chart */}
              <PriceChart 
                currentPrice={onchainPrice} 
                progressPct={stats.progressPct} 
                slopeDivisor={token.protocol?.slopeDivisor} 
              />

              {/* Bonding Curve Card */}
              {!token.protocol?.pumpForever ? (
                <div className="card" style={{ border: '1px solid var(--accent-glow)', background: 'rgba(0, 255, 136, 0.02)' }}>
                  <div className="progress-header" style={{ marginBottom: '12px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>⬡ Bonding Curve Progress</span>
                    <span className="token-time">Acki Nacki · Fair Launch</span>
                  </div>
                  
                  <div className="progress-track" style={{ height: '12px', marginBottom: '20px' }}>
                    <div className="progress-fill" style={{
                      width: stats.progressPct === null ? "0%" : `${stats.progressPct}%`,
                      background: parseFloat(stats.progressPct || "0") > 80
                        ? "linear-gradient(90deg, #f97316, #ef4444)"
                        : "linear-gradient(90deg, #00ff88, #00cc6d)",
                    }} />
                  </div>

                  <div className="token-stats" style={{ borderTop: 'none', paddingTop: 0, marginBottom: '20px' }}>
                    <div className="stat-box">
                      <span className="stat-label">Progress</span>
                      <span className="stat-value" style={{ fontSize: '18px' }}>{stats.progressPct === null ? "N/A" : `${stats.progressPct}%`}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Reserve</span>
                      <span className="stat-value" style={{ fontSize: '18px' }}>{stats.hasOnchainReserve ? `${stats.reserveShell.toFixed(2)} SHELL` : "awaiting"}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Threshold</span>
                      <span className="stat-value" style={{ fontSize: '18px' }}>15K SHELL</span>
                    </div>
                  </div>
                  
                  <p className="token-subtitle" style={{ fontSize: '11px', margin: 0, opacity: 0.8 }}>
                    {stats.hasOnchainReserve
                      ? "Liquidity auto-migrates to internal AMM at 15K SHELL reserve."
                      : "Progress requires reserveBalance indexed from blockchain. Values stay as awaiting until first trade."}
                  </p>
                </div>
              ) : (
                <div className="card" style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
                  <div className="progress-header" style={{ marginBottom: '12px' }}>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>🚀 PUMP FOREVER MODE</span>
                    <span className="token-time" style={{ color: '#ef4444' }}>High Risk</span>
                  </div>
                  <p className="token-subtitle" style={{ fontSize: '13px', margin: 0, color: 'var(--ink)' }}>
                    This token does <strong>not</strong> graduate to an AMM. Its price will continue to be discovered linearly via the bonding curve forever.
                  </p>
                  <div className="token-stats" style={{ borderTop: 'none', paddingTop: 0, marginTop: '20px', marginBottom: 0 }}>
                    <div className="stat-box" style={{ width: '100%', textAlign: 'center' }}>
                      <span className="stat-label">Current Reserve</span>
                      <span className="stat-value" style={{ fontSize: '24px', color: '#ef4444' }}>{stats.hasOnchainReserve ? `${stats.reserveShell.toFixed(2)} SHELL` : "0.00 SHELL"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Deployment Status */}
              <div className="card" style={{ border: '1px dashed var(--ink-faint)' }}>
                 <p className="info-label">Blockchain Deployment Status</p>
                 <div className="onchain-info-grid">
                    <div className="onchain-item">
                       <p className="stat-label">Status</p>
                       <p className={`info-value ${token.onchainData?.deployStatus === 'deployed' ? 'hero-accent' : ''}`} style={{ fontSize: '13px' }}>
                          {token.onchainData?.deployStatus?.replace(/_/g, ' ') || 'unknown'}
                       </p>
                    </div>
                    <div className="onchain-item">
                       <p className="stat-label">Price</p>
                       <p className="info-value" style={{ fontSize: '13px' }}>
                          {onchainPrice ? `${onchainPrice.toFixed(9)} SHELL` : "awaiting sync"}
                       </p>
                    </div>
                 </div>
                 
                 {token.onchainData?.deployStatus === 'pending_deployer_configuration' && (
                    <p style={{ color: 'var(--accent-warm)', fontSize: '11px', marginTop: '12px' }}>
                      ⚠️ The system is waiting for the administrative deployer to be funded or configured. 
                      Trading functions are available after on-chain deployment is complete.
                    </p>
                 )}
              </div>

              {/* Info Grid */}
              <div className="info-card-grid">
                <div className="info-card">
                  <p className="info-label">Current Supply</p>
                  <p className="info-value">{formatSupply(token.onchainData?.tokenSupply || token.coin.totalSupply, !!token.onchainData?.tokenSupply)}</p>
                </div>
                <div className="info-card">
                  <p className="info-label">Pump Aggressiveness</p>
                  <p className="info-value" style={{ color: getSlopeLabel(token.protocol?.slopeDivisor).color }}>
                    {getSlopeLabel(token.protocol?.slopeDivisor).label}
                  </p>
                </div>
              </div>
              <div className="info-card-grid" style={{ marginTop: '16px' }}>
                <div className="info-card">
                  <p className="info-label">Risk Profile</p>
                  <p className="info-value" style={{ color: token.riskProfile?.score > 70 ? 'var(--accent)' : 'var(--accent-warm)' }}>
                    {token.riskProfile?.score} / {token.riskProfile?.status}
                  </p>
                </div>
                <div className="info-card">
                  <p className="info-label">Creator Rewards</p>
                  <p className="info-value" style={{ fontSize: '13px', lineHeight: 1.4 }}>
                    0.3% of trading volume goes automatically to the creator.
                  </p>
                </div>
              </div>

              {/* About */}
              {token.coin.description && (
                <div className="card">
                  <p className="info-label">About {token.coin.name}</p>
                  <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>{token.coin.description}</p>
                </div>
              )}

              {/* On-chain Details */}
              <div className="card">
                <p className="info-label">On-Chain Identifiers</p>
                <div className="onchain-info-grid">
                  <div className="onchain-item">
                    <span className="stat-label">IPFS Metadata</span>
                    {token.onchainData?.ipfsHash ? (
                      <a href={`https://gateway.pinata.cloud/ipfs/${token.onchainData.ipfsHash}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {token.onchainData.ipfsHash.slice(0, 10)}...
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>Pending</span>}
                  </div>
                  <div className="onchain-item">
                    <span className="stat-label">Token Root</span>
                    {token.onchainData?.tokenRootAddress ? (
                      <a href={`https://beescan.live/accounts/${token.onchainData.tokenRootAddress}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {compactWallet(token.onchainData.tokenRootAddress)}
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>Pending</span>}
                  </div>
                  <div className="onchain-item">
                    <span className="stat-label">Bonding Curve</span>
                    {token.onchainData?.bondingCurveAddress ? (
                      <a href={`https://beescan.live/accounts/${token.onchainData.bondingCurveAddress}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {compactWallet(token.onchainData.bondingCurveAddress)}
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>Pending</span>}
                  </div>
                </div>
              </div>

              {/* Links */}
              {/* Links */}
              {(token.links?.website || token.links?.xUrl || token.links?.telegramUrl) && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {token.links.website && <a href={token.links.website} target="_blank" rel="noreferrer" className="filter-btn">🌐 Website</a>}
                  {token.links.xUrl && <a href={token.links.xUrl} target="_blank" rel="noreferrer" className="filter-btn">𝕏 Twitter</a>}
                  {token.links.telegramUrl && <a href={token.links.telegramUrl} target="_blank" rel="noreferrer" className="filter-btn">✈ Telegram</a>}
                </div>
              )}

              {/* Chat / Comments Section */}
              <div className="card" style={{ marginTop: '24px' }}>
                <p className="info-label" style={{ marginBottom: '16px' }}>💬 Community Chat</p>
                
                {/* Chat Feed */}
                <div className="chat-feed" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {comments.length === 0 ? (
                    <p className="token-time" style={{ textAlign: 'center', padding: '20px' }}>No comments yet. Be the first to hype it up!</p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} style={{ background: 'var(--bg-deep)', padding: '12px', borderRadius: '8px', borderLeft: `2px solid ${hashColor(c.walletAddress)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: hashColor(c.walletAddress), fontWeight: 600 }}>
                            {compactWallet(c.walletAddress)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--ink-soft)' }}>
                            {formatDate(c.createdAt)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {c.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="text-input"
                    style={{ flex: 1 }}
                    placeholder={session ? "Write a comment..." : "Sign in to comment"}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    disabled={!session || isPosting}
                    maxLength={500}
                  />
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={!session || !newComment.trim() || isPosting}
                    style={{ padding: '0 20px', fontSize: '13px' }}
                  >
                    {isPosting ? "..." : "Post"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Trade Widget */}
            <aside className="detail-sidebar">
              <div className="trade-widget">
                <div className="trade-tabs">
                  <button className={`trade-tab ${tradeMode === "buy" ? "active-buy" : ""}`} onClick={() => setTradeMode("buy")}>BUY</button>
                  <button className={`trade-tab ${tradeMode === "sell" ? "active-sell" : ""}`} onClick={() => setTradeMode("sell")}>SELL</button>
                </div>

                <div className="trade-panel">
                  <div className="trade-field-wrap">
                    <p className="info-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Amount to {tradeMode}</span>
                      <span style={{ fontSize: '10px', color: 'var(--ink-soft)' }}>
                        {tradeMode === "buy" && userShellEccBalance !== null && `Bal: ${userShellEccBalance.toFixed(2)} SHELL`}
                        {tradeMode === "sell" && userTokenBalance !== null && `Bal: ${userTokenBalance.toFixed(2)} ${token?.coin?.symbol || ''}`}
                      </span>
                    </p>
                    <div className="input-container">
                      <input type="number" placeholder="0.0" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} />
                      <span className="input-unit">{tradeMode === "buy" ? "SHELL" : token.coin.symbol}</span>
                    </div>

                    {/* Quick Trade Percentages */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                      {[0.25, 0.50, 0.75, 1.0].map((pct) => (
                        <button 
                          key={pct}
                          type="button"
                          className="slip-btn"
                          style={{ flex: 1, padding: '4px 0' }}
                          onClick={() => {
                            if (tradeMode === "buy") {
                              if (userShellEccBalance !== null) {
                                // Reserve 0.2 SHELL for VMSHELL gas if MAX
                                const amount = userShellEccBalance * pct;
                                const maxSafe = Math.max(0, amount - (pct === 1.0 ? 0.2 : 0));
                                setTradeAmount(maxSafe > 0 ? maxSafe.toFixed(2) : "");
                              }
                            } else {
                              if (userTokenBalance !== null) {
                                setTradeAmount((userTokenBalance * pct).toFixed(2));
                              }
                            }
                          }}
                        >
                          {pct === 1.0 ? "MAX" : `${pct * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="slippage-row">
                    <span className="info-label" style={{ fontSize: '9px' }}>Slippage</span>
                    <div className="slippage-btns">
                      {["1", "2", "5"].map(p => (
                        <button key={p} className={`slip-btn ${slippage === p ? "active" : ""}`} onClick={() => setSlippage(p)}>{p}%</button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const estimate = getEstimate();
                    return (
                      <>
                        <div className="estimate-box">
                          <span className="estimate-label">Receive ≈</span>
                          <span className="estimate-val">
                            {estimate.value} {tradeMode === "buy" ? token.coin.symbol : "SHELL"}
                          </span>
                        </div>

                        {estimate.fee && (
                          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                            <span className="token-time" style={{ fontSize: '10px', color: 'var(--accent-warm)' }}>
                              Fee: {estimate.fee} SHELL (1% — 0.7% platform + 0.3% creator)
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {onchainPrice && (
                    <p className="token-time" style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>
                      Current price: {onchainPrice.toFixed(9)} SHELL per token
                    </p>
                  )}

                  <button 
                    className={`trade-button ${tradeMode === 'buy' ? 'btn-buy' : 'btn-sell'}`}
                    onClick={handleTrade}
                    disabled={isTrading || token.onchainData?.deployStatus !== 'deployed'}
                  >
                    {isTrading 
                      ? "Processando Tx..." 
                      : token.onchainData?.deployStatus !== 'deployed'
                        ? "Aguardando deploy on-chain..."
                        : `Finalizar ${tradeMode.toUpperCase()}`
                    }
                  </button>
                  
                  {tradeSuccess && (
                    <p className="hero-accent" style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', fontWeight: 600 }}>
                      {tradeSuccess}
                    </p>
                  )}
                  
                  {tradeMode === "sell" && (
                    <p className="token-time" style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px' }}>
                      Sell burns your tokens via TokenWallet → BondingCurve refund.
                    </p>
                  )}

                  <p className="token-time" style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px' }}>
                    Need SHELL? <Link href={`/buy-shell?from=/token/${id}`} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Buy with card or crypto →</Link>
                  </p>
                </div>
              </div>

              {!session && (
                <div className="card" style={{ marginTop: '16px', textAlign: 'center', padding: '16px' }}>
                  <p className="token-time" style={{ marginBottom: '12px' }}>Sign in to track your trades</p>
                  <Link href={`/auth?from=/token/${id}`} className="filter-btn" style={{ display: 'block' }}>Connect Wallet</Link>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
