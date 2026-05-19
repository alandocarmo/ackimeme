import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getLaunchById, getSession, getComments, postComment, getSocket } from "../../lib/api";
import { BondingCurveAbi, TokenWalletAbi, TokenRootAbi } from "../../lib/abi";
import { useToast } from "../../lib/useToast";
import { formatNum, getSlopeLabel, formatSupply, compactWallet, isSafeUrl, formatDate } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

// Removed duplicated functions

function PriceChart({ currentPrice, progressPct, slopeDivisor }) {
  const { t } = useI18n();
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
          <p className="info-label" style={{ margin: 0, fontSize: '10px' }}>{t("detail_bonding_curve")}</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            {currentPrice ? `${currentPrice.toFixed(9)}` : '---'} <span style={{ fontSize: '12px', fontWeight: 400 }}>{t("common_shell")}</span>
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
         {t("info_bonding_curve")}: {pct}%
       </div>
    </div>
  );
}

// BubbleMap: SVG-based Sunflower Spiral packing for top holders
function BubbleMap({ holders, totalSupply }) {
  const placedNodes = useMemo(() => {
    if (!holders || holders.length === 0) return [];

    const SVG_SIZE = 320;
    const CENTER = SVG_SIZE / 2;
    const placed = [];

    const sortedNodes = [...holders].map((h, i) => {
      const pct = (h.balance / totalSupply) * 100;
      const r = Math.max(8, Math.sqrt(pct) * 12);
      return { ...h, pct, r, id: i };
    }).sort((a, b) => b.balance - a.balance);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      let angle = 0;
      let dist = 0;
      let cx = CENTER, cy = CENTER;
      let overlapping = true;
      let attempts = 0;

      while (overlapping && attempts < 400) {
        cx = CENTER + Math.cos(angle) * dist;
        cy = CENTER + Math.sin(angle) * dist;

        overlapping = placed.some(p => {
          const dx = p.cx - cx;
          const dy = p.cy - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          return d < (p.r + node.r + 3);
        });

        if (overlapping) {
          dist += 1.5;
          angle += 2.39996;
          attempts++;
        }
      }
      node.cx = cx;
      node.cy = cy;
      placed.push(node);
    }
    return placed;
  }, [holders, totalSupply]);

  if (placedNodes.length === 0) return null;
  const SVG_SIZE = 320;

  return (
    <div style={{ background: 'var(--bg-deep)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
      <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        {placedNodes.map(n => (
          <g key={n.id} transform={`translate(${n.cx}, ${n.cy})`} style={{ transition: 'transform 0.3s ease' }}>
            <circle 
              r={n.r} 
              fill={n.isBondingCurve ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
              stroke={n.isBondingCurve ? '#3b82f6' : hashColor(n.walletAddress)}
              strokeWidth="2"
            />
             {n.r > 15 && (
               <text textAnchor="middle" dy=".3em" fill="#fff" fontSize={n.r > 25 ? "10px" : "8px"} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                 {n.pct.toFixed(1)}%
               </text>
            )}
            <title>{n.isBondingCurve ? "Bonding Curve" : compactWallet(n.walletAddress)}: {n.pct.toFixed(2)}%</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CandlestickChart({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="card chart-card" style={{ height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--ink-soft)', border: '1px solid var(--ink-faint)', background: '#0a0a0a' }}>
        No price history available yet. Start trading to generate candles!
      </div>
    );
  }

  let minPrice = Math.min(...history.map(c => c.low));
  let maxPrice = Math.max(...history.map(c => c.high));
  
  const priceDiff = maxPrice - minPrice;
  const padding = priceDiff === 0 ? minPrice * 0.1 : priceDiff * 0.1;
  minPrice = Math.max(0, minPrice - padding);
  maxPrice = maxPrice + padding;

  const width = 1000;
  const height = 240;
  const paddingLeft = 10;
  const paddingRight = 80;
  const paddingTop = 20;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const scaleY = (val) => {
    if (maxPrice - minPrice === 0) return paddingTop + chartHeight / 2;
    return paddingTop + chartHeight - ((val - minPrice) / (maxPrice - minPrice)) * chartHeight;
  };

  const candleWidth = Math.max(2, (chartWidth / history.length) * 0.7);
  const gap = (chartWidth / history.length) * 0.3;

  return (
    <div className="card chart-card" style={{ height: '240px', padding: '10px', border: '1px solid var(--ink-faint)', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
          const price = minPrice + (maxPrice - minPrice) * p;
          const y = scaleY(price);
          return (
            <g key={idx}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={width - paddingRight + 5} y={y + 4} fill="var(--ink-soft)" fontSize="10" fontFamily="monospace">
                {price.toFixed(9)}
              </text>
            </g>
          );
        })}

        {/* Candles */}
        {history.map((candle, idx) => {
          const x = paddingLeft + idx * (chartWidth / history.length) + gap / 2;
          const openY = scaleY(candle.open);
          const closeY = scaleY(candle.close);
          const highY = scaleY(candle.high);
          const lowY = scaleY(candle.low);

          const isUp = candle.close >= candle.open;
          const color = isUp ? '#10b981' : '#ef4444';

          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(2, Math.abs(closeY - openY));

          return (
            <g key={idx}>
              <line x1={x + candleWidth / 2} y1={highY} x2={x + candleWidth / 2} y2={lowY} stroke={color} strokeWidth="1.5" />
              <rect x={x} y={bodyY} width={candleWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth="1" rx="1" />
            </g>
          );
        })}
      </svg>
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

// C4 FIX: Removed local isSafeUrl — using the more secure version imported from lib/utils

// Local getSlopeLabel removed, using shared utility

export default function TokenPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = router.query;
  const [token, setToken] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast, ToastContainer } = useToast();

  const [isFavorite, setIsFavorite] = useState(false);
  const [chartTab, setChartTab] = useState("theory"); // theory | live
  const [priceHistory, setPriceHistory] = useState([]);
  const [selectedInterval, setSelectedInterval] = useState(15);

  // M2 FIX: wrap setTradeMode to clear stale messages
  const [tradeMode, _setTradeMode] = useState("buy");
  function setTradeMode(mode) {
    _setTradeMode(mode);
    setError("");
    setTradeSuccess("");
    setTradeAmount("");
  }
  const [tradeAmount, setTradeAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [isTrading, setIsTrading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState("");
  const [onchainPrice, setOnchainPrice] = useState(null); // from getter
  const [sellReturn, setSellReturn] = useState(null); // specific for tradeAmount
  const [buyReturn, setBuyReturn] = useState(null); // specific for tradeAmount

  // Balances for quick trade %
  const [userShellEccBalance, setUserShellEccBalance] = useState(null);
  const [userTokenBalance, setUserTokenBalance] = useState(null);

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
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [trades, setTrades] = useState([]);
  const [holders, setHolders] = useState([]);
  const [totalSupply, setTotalSupply] = useState(1000000000);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then(r => setSession(r.session)).catch(() => {});
  }, []);

  // Fetch Favorites status for this user
  useEffect(() => {
    if (!session || !id) return;
    import("../../lib/api").then(({ getFavorites }) => {
      getFavorites()
        .then(r => {
          const favs = r.launches || [];
          setIsFavorite(favs.some(f => f.id === id));
        })
        .catch(() => {});
    });
  }, [session, id]);

  const handleToggleFavorite = useCallback(async () => {
    if (!session) return router.push(`/auth?from=/token/${id}`);
    try {
      const { addFavorite, removeFavorite } = await import("../../lib/api");
      if (isFavorite) {
        await removeFavorite(id);
        setIsFavorite(false);
        toast.success("Removed", "Removido dos favoritos!");
      } else {
        await addFavorite(id);
        setIsFavorite(true);
        toast.success("Added", "Adicionado aos favoritos!");
      }
    } catch (err) {
      toast.error("Erro", err.message || "Erro ao atualizar favoritos.");
    }
  }, [session, id, isFavorite, toast, router]);

  // Fetch Candlestick Price History
  const fetchPriceHistory = useCallback(() => {
    if (!id) return;
    import("../../lib/api").then(({ getPriceHistory }) => {
      getPriceHistory(id, selectedInterval)
        .then(r => {
          setPriceHistory(r.history || []);
        })
        .catch((err) => console.error("Error fetching price history", err));
    });
  }, [id, selectedInterval]);

  useEffect(() => {
    fetchPriceHistory();
  }, [fetchPriceHistory, trades]);

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

  // C6 FIX: Removed duplicate useEffect for fetchUserBalances

  // Separate effect for buy return (binary search) to provide exact amounts and calculate impact
  useEffect(() => {
    if (tradeMode !== "buy" || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setBuyReturn(null);
      return;
    }
    if (!token?.onchainData?.bondingCurveAddress || token.onchainData.deployStatus !== "deployed") return;
    
    if (!onchainPrice) return;

    let cancelled = false;
    (async () => {
      try {
        const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
        const ever = new ProviderRpcClient();
        if (!(await ever.hasProvider())) return;
        await ever.ensureInitialized();
        const bcContract = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress));
        
        const rawAmountNano = toNano(tradeAmount);
        // maxBaseCostNano = rawAmountNano * 100 / 101
        const maxBaseCostNano = (rawAmountNano * 100n) / 101n;
        
        let low = 0n;
        let high = rawAmountNano * 100000000n;
        const currentPriceNano = toNano(String(onchainPrice));
        
        if (currentPriceNano > 0n) {
           const spotEst = (maxBaseCostNano * 1000000000n) / currentPriceNano;
           high = spotEst;
           low = spotEst / 2n;
        }

        let bestMid = 0n;
        for (let i = 0; i < 25; i++) {
            const mid = (low + high) / 2n;
            if (mid === 0n) break;
            
            try {
                const costResult = await bcContract.methods.getBuyPrice({ tokenAmount: mid.toString() }).call();
                const cost = BigInt(costResult.value0);
                
                if (cost <= maxBaseCostNano) {
                    bestMid = mid;
                    low = mid + 1n;
                } else {
                    high = mid - 1n;
                }
            } catch (err) {
                high = mid - 1n;
            }
        }
        
        if (!cancelled && bestMid > 0n) {
            setBuyReturn(Number(bestMid) / 1e9);
        } else if (!cancelled) {
            setBuyReturn(0);
        }
      } catch (err) {
        console.warn("Buy estimate failed", err);
      }
    })();

    return () => { cancelled = true; };
  }, [tradeAmount, tradeMode, token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus, onchainPrice]);

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
    
    // Initial fetch for comments, trades, and holders
    getComments(id).then(r => setComments(r.comments || [])).catch(() => {});
    import("../../lib/api").then(api => {
      if (api.getTrades) {
        api.getTrades(id).then(r => setTrades(r.trades || [])).catch(() => {});
      }
      if (api.getHolders) {
        api.getHolders(id).then(r => {
          setHolders(r.holders || []);
          if (r.totalSupply) setTotalSupply(r.totalSupply);
        }).catch(() => {});
      }
    });
    
    const socket = getSocket();
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

    const handleNewTrade = (trade) => {
      setTrades((prev) => {
        if (prev.find((t) => t.id === trade.id)) return prev;
        return [trade, ...prev];
      });
      // Refresh holders when a trade happens to keep the leaderboard somewhat live
      import("../../lib/api").then(api => {
        if (api.getHolders) {
          api.getHolders(id).then(r => {
            setHolders(r.holders || []);
            if (r.totalSupply) setTotalSupply(r.totalSupply);
          }).catch(() => {});
        }
      });
    };

    socket.on("token_updated", handleTokenUpdated);
    socket.on("new_comment", handleNewComment);
    socket.on("new_trade", handleNewTrade);

    return () => {
      socket.off("token_updated", handleTokenUpdated);
      socket.off("new_comment", handleNewComment);
      socket.off("new_trade", handleNewTrade);
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
      // M4 FIX: NaN not caught by <= 0 comparison
      if (!tradeAmount || !Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error("Valor inválido.");

      const isBuy = tradeMode === "buy";
      const rawAmountNano = toNano(tradeAmount);
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

        // C5 FIX: Block sell when price is not available (prevents zero slippage)
        if (!currentPrice && sellReturn === null) {
          throw new Error("Preço on-chain não disponível ainda. Aguarde a sincronização.");
        }
        // 3. Calculate minShellOut for slippage protection
        const grossReturnForSlippage = sellReturn !== null ? toNano(String(sellReturn)) : 0n;
        if (grossReturnForSlippage === 0n) {
          throw new Error("Não foi possível calcular o retorno da venda. Tente novamente.");
        }
        const minShellOutNano = grossReturnForSlippage * BigInt(Math.round(100 - slippagePct)) / 100n;

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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleToggleFavorite}
                      style={{
                        background: isFavorite ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: isFavorite ? '#eab308' : 'var(--ink-soft)',
                        border: isFavorite ? '1px solid rgba(250, 204, 21, 0.3)' : '1px solid var(--ink-faint)',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{isFavorite ? "★" : "☆"}</span>
                      {isFavorite ? "Favorited" : "Favorite"}
                    </button>

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
              </div>

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
                    progressPct={stats.progressPct} 
                    slopeDivisor={token.protocol?.slopeDivisor} 
                  />
                ) : (
                  <CandlestickChart history={priceHistory} />
                )}
              </div>

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
                      <span className="stat-label">{t("card_progress")}</span>
                      <span className="stat-value" style={{ fontSize: '18px' }}>{stats.progressPct === null ? "N/A" : `${stats.progressPct}%`}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">{t("card_reserve")}</span>
                      <span className="stat-value" style={{ fontSize: '18px' }}>{stats.hasOnchainReserve ? `${stats.reserveShell.toFixed(2)} ${t("common_shell")}` : t("info_pending")}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Threshold</span>
                      <span className="stat-value" style={{ fontSize: '18px' }}>15K {t("common_shell")}</span>
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
                       <p className="stat-label">{t("info_status")}</p>
                       <p className={`info-value ${token.onchainData?.deployStatus === 'deployed' ? 'hero-accent' : ''}`} style={{ fontSize: '13px' }}>
                          {token.onchainData?.deployStatus?.replace(/_/g, ' ') || 'unknown'}
                       </p>
                    </div>
                    <div className="onchain-item">
                       <p className="stat-label">Price</p>
                       <p className="info-value" style={{ fontSize: '13px' }}>
                          {onchainPrice ? `${onchainPrice.toFixed(9)} ${t("common_shell")}` : t("info_pending")}
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
                  <p className="info-label">{t("info_supply")}</p>
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
                  <p className="info-label">{t("info_creator_rewards")}</p>
                  <p className="info-value" style={{ fontSize: '13px', lineHeight: 1.4 }}>
                    {t("info_creator_rewards_desc")}
                  </p>
                </div>
              </div>

              {/* About */}
              {token.coin.description && (
                <div className="card">
                  <p className="info-label">{t("info_about")} {token.coin.name}</p>
                  <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>{token.coin.description}</p>
                </div>
              )}

              {/* On-chain Details */}
              <div className="card">
                <p className="info-label">{t("info_onchain")}</p>
                <div className="onchain-info-grid">
                  <div className="onchain-item">
                    <span className="stat-label">{t("info_ipfs")}</span>
                    {token.onchainData?.ipfsHash ? (
                      <a href={`https://gateway.pinata.cloud/ipfs/${token.onchainData.ipfsHash}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {token.onchainData.ipfsHash.slice(0, 10)}...
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>{t("info_pending")}</span>}
                  </div>
                  <div className="onchain-item">
                    <span className="stat-label">{t("info_token_root")}</span>
                    {token.onchainData?.tokenRootAddress ? (
                      <a href={`https://beescan.live/accounts/${token.onchainData.tokenRootAddress}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {compactWallet(token.onchainData.tokenRootAddress)}
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>{t("info_pending")}</span>}
                  </div>
                  <div className="onchain-item">
                    <span className="stat-label">{t("info_bonding_curve")}</span>
                    {token.onchainData?.bondingCurveAddress ? (
                      <a href={`https://beescan.live/accounts/${token.onchainData.bondingCurveAddress}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {compactWallet(token.onchainData.bondingCurveAddress)}
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>{t("info_pending")}</span>}
                  </div>
                </div>
              </div>

              {/* Links */}
              {(token.links?.website || token.links?.xUrl || token.links?.telegramUrl) && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {token.links.website && <a href={token.links.website} target="_blank" rel="noreferrer" className="filter-btn">🌐 Website</a>}
                  {token.links.xUrl && <a href={token.links.xUrl} target="_blank" rel="noreferrer" className="filter-btn">𝕏 Twitter</a>}
                  {token.links.telegramUrl && <a href={token.links.telegramUrl} target="_blank" rel="noreferrer" className="filter-btn">✈ Telegram</a>}
                </div>
              )}

              {/* Trade History Tape */}
              <div className="card" style={{ marginTop: '24px' }}>
                <p className="info-label" style={{ marginBottom: '16px' }}>{t("trades_title")}</p>
                <div className="trade-tape" style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trades.length === 0 ? (
                    <p className="token-time" style={{ textAlign: 'center', padding: '20px' }}>{t("trades_empty")}</p>
                  ) : (
                    trades.map((trade) => (
                      <div key={trade.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'var(--bg-deep)', borderRadius: '6px', borderLeft: `4px solid ${trade.type === 'buy' ? '#10b981' : '#ef4444'}` }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ color: trade.type === 'buy' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', width: '40px' }}>{trade.type}</span>
                          <span style={{ fontSize: '12px', color: hashColor(trade.walletAddress) }}>{compactWallet(trade.walletAddress)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>{formatNum(nanoToDecimal(trade.tokenAmount).toFixed(2))} {token.coin?.symbol}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-soft)' }}>{nanoToDecimal(trade.shellAmount).toFixed(4)} SHELL</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Holders Leaderboard */}
              <div className="card" style={{ marginTop: '24px' }}>
                <p className="info-label" style={{ marginBottom: '16px' }}>{t("holders_title")}</p>
                <BubbleMap holders={holders} totalSupply={totalSupply} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {holders.length === 0 ? (
                    <p className="token-time" style={{ textAlign: 'center', padding: '20px' }}>{t("holders_empty")}</p>
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
              <div className="card" style={{ marginTop: '24px' }}>
                <p className="info-label" style={{ marginBottom: '16px' }}>{t("chat_title")}</p>
                
                {/* Chat Feed */}
                <div className="chat-feed" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {comments.length === 0 ? (
                    <p className="token-time" style={{ textAlign: 'center', padding: '20px' }}>{t("chat_empty")}</p>
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
                    placeholder={session ? t("chat_placeholder") : t("chat_signin")}
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
                    {isPosting ? "..." : t("chat_send")}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Trade Widget */}
            <aside className="detail-sidebar">
              <div className="trade-widget">
                <div className="trade-tabs">
                  <button className={`trade-tab ${tradeMode === "buy" ? "active-buy" : ""}`} onClick={() => setTradeMode("buy")}>{t("detail_buy")}</button>
                  <button className={`trade-tab ${tradeMode === "sell" ? "active-sell" : ""}`} onClick={() => setTradeMode("sell")}>{t("detail_sell")}</button>
                </div>

                <div className="trade-panel">
                  <div className="trade-field-wrap">
                    <p className="info-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{tradeMode === "buy" ? t("detail_amount_shell") : t("detail_amount_tokens")}</span>
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
                    <span className="info-label" style={{ fontSize: '9px' }}>{t("detail_slippage")}</span>
                    <div className="slippage-btns">
                      {["1", "2", "5"].map(p => (
                        <button key={p} className={`slip-btn ${slippage === p ? "active" : ""}`} onClick={() => setSlippage(p)}>{p}%</button>
                      ))}
                    </div>
                  </div>

                  {/* A6 FIX: Use memoized estimate instead of IIFE that recalculates every render */}
                  {(() => {
                    const estimate = memoizedEstimate;
                    return (
                      <>
                        <div className="estimate-box">
                          <span className="estimate-label">{t("detail_estimated_return")} ≈</span>
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
                        
                        {estimate.impact !== null && estimate.impact > 0.01 && (
                          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                            <span style={{ 
                               fontSize: '11px', 
                               fontWeight: 600,
                               color: estimate.impact > 5 ? '#ef4444' : (estimate.impact > 2 ? '#f97316' : '#10b981')
                            }}>
                              {t("detail_price_impact")}: {estimate.impact.toFixed(2)}%
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
                      ? t("detail_processing") 
                      : token.onchainData?.deployStatus !== 'deployed'
                        ? t("info_pending")
                        : (tradeMode === "buy" ? t("detail_execute_buy") : t("detail_execute_sell"))
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
                  <p className="token-time" style={{ marginBottom: '12px' }}>{t("detail_connect_wallet")}</p>
                  <Link href={`/auth?from=/token/${id}`} className="filter-btn" style={{ display: 'block' }}>{t("nav_connect")}</Link>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
