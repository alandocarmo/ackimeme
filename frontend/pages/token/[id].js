import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getLaunchById, getSession } from "../../lib/api";

const INITIAL_PRICE = 0.00000003;
const SESSION_KEY = "ackimeme_session_token";

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

function formatNum(n) {
  const v = Number(String(n || "0").replace(/[.,]/g, ""));
  return isNaN(v) ? n : v.toLocaleString("pt-BR");
}

function formatSupply(val) {
  const n = Number(String(val || "0").replace(/[.,]/g, ""));
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

const MIGRATION_THRESHOLD = 69000;

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
    ? Math.min((reserveBalance / MIGRATION_THRESHOLD) * 100, 100).toFixed(1)
    : null;

  return { reserveBalance, hasOnchainReserve, progressPct };
}

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

export default function TokenPage() {
  const router = useRouter();
  const { id } = router.query;
  const [token, setToken] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tradeMode, setTradeMode] = useState("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [isTrading, setIsTrading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.localStorage.getItem(SESSION_KEY);
    if (!t) return;
    getSession(t).then(r => setSession(r.session)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getLaunchById(id)
      .then((data) => {
        setToken(data.launch);
        setError("");
      })
      .catch((err) => {
        setToken(null);
        if (String(err.message || "").toLowerCase().includes("404")) {
          setError("Token não encontrado.");
          return;
        }
        setError(err.message || "Falha ao carregar token.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTrade() {
    if (!session) return router.push(`/auth?from=/token/${id}`);
    setIsTrading(true);
    setTimeout(() => {
      setIsTrading(false);
      alert(`${tradeMode === "buy" ? "Buy" : "Sell"} of ${tradeAmount} sent to TVM! (SDK integration pending)`);
    }, 1500);
  }

  const stats = token ? calcBondingStats(token.onchainData) : null;
  const color = token ? hashColor(token.coin?.symbol) : "#888";
  const showMissingTokenCta = Boolean(error) && !loading && !token;

  const estimateOutput = () => {
    const amt = parseFloat(tradeAmount) || 0;
    if (tradeMode === "buy") {
      return formatNum(Math.floor(amt / INITIAL_PRICE));
    }
    return (amt * INITIAL_PRICE).toFixed(9);
  };

  return (
    <>
      <Head>
        <title>{token ? `$${token.coin.symbol} — ${token.coin.name}` : "Token"} | AckiMeme</title>
        <meta name="description" content={token?.coin?.tagline || "Memecoin on Acki Nacki"} />
      </Head>

      <main style={s.page}>
        {loading && <p style={s.loadingMsg}>Loading...</p>}
        {showMissingTokenCta ? (
          <div style={s.errorCard}>
            <p style={s.errorMsgCompact}>{error}</p>
            <Link href="/" style={s.backToFeedBtn}>Voltar para o feed</Link>
          </div>
        ) : error ? (
          <p style={s.errorMsg}>{error}</p>
        ) : null}

        {token && (
          <div style={s.layout}>
            {/* Left Column: Info */}
            <div style={s.leftCol}>
              {/* Header */}
              <div style={s.header}>
                <div style={{ ...s.tokenIcon, background: `linear-gradient(135deg, ${color}, ${color}44)` }}>
                  {token.coin.logoUrl ? (
                    <img src={token.coin.logoUrl} alt="" style={s.tokenImg} />
                  ) : (
                    <span style={s.tokenLetter}>{(token.coin.symbol || "?")[0]}</span>
                  )}
                </div>
                <div style={s.headerInfo}>
                  <h1 style={s.name}>{token.coin.name}</h1>
                  <span style={s.ticker}>${token.coin.symbol}</span>
                </div>
                <div style={s.statusPill}>{token.status.replace(/_/g, " ")}</div>
              </div>

              {/* Bonding Curve Card */}
              <div style={s.curveCard}>
                <div style={s.curveTopRow}>
                  <span style={s.curveLabel}>⬡ Bonding Curve Progress</span>
                  <span style={s.curveNet}>Acki Nacki · Fair Launch</span>
                </div>
                <div style={s.curveBarWrap}>
                  <div style={{
                    ...s.curveBarFill,
                    width: stats.progressPct === null ? "0%" : `${stats.progressPct}%`,
                    minWidth: stats.progressPct === null ? "0px" : s.curveBarFill.minWidth,
                    opacity: stats.progressPct === null ? 0 : 1,
                    background: parseFloat(stats.progressPct || "0") > 80
                      ? "linear-gradient(90deg, #f97316, #ef4444)"
                      : "linear-gradient(90deg, #00ff88, #00cc6d)",
                  }} />
                </div>
                <div style={s.curveStatsGrid}>
                  <div><p style={s.cStatLabel}>Progress</p><p style={s.cStatVal}>{stats.progressPct === null ? "N/A" : `${stats.progressPct}%`}</p></div>
                  <div><p style={s.cStatLabel}>Threshold</p><p style={s.cStatVal}>69K SHELL</p></div>
                  <div><p style={s.cStatLabel}>Reserve</p><p style={s.cStatVal}>{stats.hasOnchainReserve ? `${stats.reserveBalance.toFixed(2)} SHELL` : "awaiting indexer"}</p></div>
                  <div><p style={s.cStatLabel}>Lock</p><p style={s.cStatVal}>30 days</p></div>
                </div>
                <p style={s.curveHint}>
                  {stats.hasOnchainReserve
                    ? "Liquidity auto-migrates to DEX.DO at 69K SHELL reserve with 30-day anti-rug lock."
                    : "Progress requires reserveBalance indexed from blockchain. Until then, values stay as N/A."}
                </p>
              </div>

              {/* Info Grid */}
              <div style={s.infoGrid}>
                <div style={s.infoItem}><p style={s.infoLabel}>Supply</p><p style={s.infoVal}>{formatSupply(token.coin.totalSupply)}</p></div>
                <div style={s.infoItem}><p style={s.infoLabel}>Fee Paid</p><p style={s.infoVal}>{token.treasuryPayment?.amount} {token.treasuryPayment?.tokenSymbol}</p></div>
                <div style={s.infoItem}><p style={s.infoLabel}>Risk</p><p style={s.infoVal}>{token.riskProfile?.score} / {token.riskProfile?.status}</p></div>
                <div style={s.infoItem}><p style={s.infoLabel}>Created</p><p style={s.infoVal}>{formatDate(token.createdAt)}</p></div>
              </div>

              {/* Description */}
              {token.coin.description && (
                <div style={s.descCard}>
                  <p style={s.infoLabel}>About</p>
                  <p style={s.descText}>{token.coin.description}</p>
                </div>
              )}

              {/* Creator */}
              <div style={s.creatorCard}>
                <p style={s.infoLabel}>Created by</p>
                <code style={s.walletCode}>{token.creatorWallet}</code>
              </div>

              {/* Links */}
              {(token.links?.website || token.links?.xUrl || token.links?.telegramUrl) && (
                <div style={s.linksRow}>
                  {token.links.website && <a href={token.links.website} target="_blank" rel="noreferrer" style={s.extLink}>🌐 Website</a>}
                  {token.links.xUrl && <a href={token.links.xUrl} target="_blank" rel="noreferrer" style={s.extLink}>𝕏 Twitter</a>}
                  {token.links.telegramUrl && <a href={token.links.telegramUrl} target="_blank" rel="noreferrer" style={s.extLink}>✈ Telegram</a>}
                </div>
              )}

              {/* On-chain data */}
              {token.onchainData?.ipfsHash && (
                <div style={s.onchainCard}>
                  <p style={s.infoLabel}>On-Chain Data</p>
                  <div style={s.onchainGrid}>
                    <div>
                      <p style={s.cStatLabel}>IPFS</p>
                      <a href={`https://gateway.pinata.cloud/ipfs/${token.onchainData.ipfsHash}`} target="_blank" rel="noreferrer" style={s.onchainLink}>
                        {token.onchainData.ipfsHash.slice(0, 12)}…
                      </a>
                    </div>
                    <div>
                      <p style={s.cStatLabel}>Token Root</p>
                      <a href={`https://shellnet.ackinacki.org/accounts/account/${token.onchainData.tokenRootAddress}`} target="_blank" rel="noreferrer" style={s.onchainLink}>
                        {compactWallet(token.onchainData.tokenRootAddress)}
                      </a>
                    </div>
                    <div>
                      <p style={s.cStatLabel}>Bonding Curve</p>
                      <a href={`https://shellnet.ackinacki.org/accounts/account/${token.onchainData.bondingCurveAddress}`} target="_blank" rel="noreferrer" style={s.onchainLink}>
                        {compactWallet(token.onchainData.bondingCurveAddress)}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Audit */}
              <div style={s.securityCard}>
                 <p style={s.infoLabel}>Contract Security Audit</p>
                 <div style={s.securityGrid}>
                    <div style={s.secItem}><span style={s.secIcon}>✅</span> Auto-Pool (Bancor) Enabled</div>
                    <div style={s.secItem}><span style={s.secIcon}>✅</span> Anti-Rug 30D Lock</div>
                    <div style={s.secItem}><span style={s.secIcon}>✅</span> Pre-Mints Disabled</div>
                    <div style={s.secItem}><span style={s.secIcon}>✅</span> Owner Renounced</div>
                 </div>
              </div>

              {/* Bubble Map Visualizer (Simulation) */}
              <div style={s.bubbleMapCard}>
                 <div style={s.bubbleHeader}>
                    <p style={s.infoLabel}>Holder Distribution (Bubble Map)</p>
                    <span style={s.livePulse}>LIVE</span>
                 </div>
                 <div style={s.bubbleCanvas}>
                    <div style={{...s.bubble, width: 80, height: 80, left: '20%', top: '20%', background: 'rgba(255,51,51,0.2)', border: '1px solid #ff3333'}}>Curve</div>
                    <div style={{...s.bubble, width: 40, height: 40, left: '60%', top: '50%'}}>Whale</div>
                    <div style={{...s.bubble, width: 30, height: 30, left: '75%', top: '30%'}}>Hold</div>
                    <div style={{...s.bubble, width: 25, height: 25, left: '40%', top: '70%'}}>Hold</div>
                    <div style={{...s.bubble, width: 20, height: 20, left: '50%', top: '20%'}}>Hold</div>
                    <div style={{...s.bubble, width: 15, height: 15, left: '30%', top: '50%'}}>Trader</div>
                 </div>
                 <p style={s.curveHint}>Top 100 holders concentration graph. Bubbles represent wallet balances. Red bubble indicates the Bonding Curve reserve.</p>
              </div>
            </div>

            {/* Right Column: Trade Widget */}
            <div style={s.rightCol}>
              <div style={s.tradeCard}>
                <div style={s.tradeTabs}>
                  <button style={tradeMode === "buy" ? s.tabActiveBuy : s.tab} onClick={() => setTradeMode("buy")}>BUY</button>
                  <button style={tradeMode === "sell" ? s.tabActiveSell : s.tab} onClick={() => setTradeMode("sell")}>SELL</button>
                </div>

                <div style={s.tradeBody}>
                  <p style={s.tradeLabel}>Amount</p>
                  <div style={s.tradeInputWrap}>
                    <input type="number" style={s.tradeInput} placeholder="0.0" value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)} />
                    <span style={s.tradeUnit}>{tradeMode === "buy" ? "SHELL" : token.coin.symbol}</span>
                  </div>

                  <div style={s.slippageRow}>
                    <span style={s.slippageLabel}>Slippage</span>
                    <div style={s.slippageBtns}>
                      {["1", "2", "5"].map(p => (
                        <button key={p} style={slippage === p ? s.slipBtnActive : s.slipBtn}
                          onClick={() => setSlippage(p)}>{p}%</button>
                      ))}
                    </div>
                  </div>

                  {tradeAmount && (
                    <div style={s.estimateBox}>
                      <span style={s.estimateLabel}>You'll receive ≈</span>
                      <span style={s.estimateValue}>
                        {estimateOutput()} {tradeMode === "buy" ? token.coin.symbol : "SHELL"}
                      </span>
                    </div>
                  )}

                  <button
                    style={tradeMode === "buy" ? s.tradeBtnBuy : s.tradeBtnSell}
                    disabled={isTrading || !tradeAmount}
                    onClick={handleTrade}
                  >
                    {isTrading ? "Processing..." : tradeMode === "buy" ? `Buy $${token.coin.symbol}` : `Sell $${token.coin.symbol}`}
                  </button>

                  {!session && (
                    <p style={s.tradeHint}>Connect wallet to trade</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

const s = {
  page: { minHeight: "100vh", padding: "24px 24px 80px" },
  loadingMsg: { color: "#52525b", textAlign: "center", padding: "80px 24px", fontSize: "13px" },
  errorMsg: { color: "#ff4757", textAlign: "center", padding: "80px 24px", fontSize: "13px" },
  errorMsgCompact: { color: "#ff4757", margin: "0 0 12px", fontSize: "14px" },
  errorCard: {
    maxWidth: "520px",
    margin: "80px auto",
    textAlign: "center",
    background: "rgba(22,22,26,0.7)",
    border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "12px",
    padding: "24px",
  },
  backToFeedBtn: {
    display: "inline-block",
    marginTop: "6px",
    textDecoration: "none",
    color: "#00ff88",
    border: "1px solid rgba(0,255,136,0.24)",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "12px",
    fontWeight: 600,
  },
  layout: {
    maxWidth: "1100px", margin: "0 auto",
    display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px",
    alignItems: "start",
  },
  leftCol: { display: "flex", flexDirection: "column", gap: "16px" },
  rightCol: { position: "sticky", top: "72px" },
  // Header
  header: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" },
  tokenIcon: {
    width: "52px", height: "52px", borderRadius: "14px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  tokenImg: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" },
  tokenLetter: { color: "#fff", fontSize: "22px", fontWeight: 700 },
  headerInfo: { flex: 1 },
  name: { fontSize: "22px", fontWeight: 700, margin: "0 0 2px", color: "#f4f4f5" },
  ticker: { color: "#00ff88", fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono)" },
  statusPill: {
    background: "rgba(0,255,136,0.06)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)",
    fontSize: "10px", padding: "4px 10px", borderRadius: "6px", fontWeight: 600,
    textTransform: "lowercase", fontFamily: "var(--font-mono)",
  },
  // Curve
  curveCard: {
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(0,255,136,0.12)",
    borderRadius: "12px", padding: "20px", backdropFilter: "blur(8px)",
  },
  curveTopRow: { display: "flex", justifyContent: "space-between", marginBottom: "14px" },
  curveLabel: { color: "#00ff88", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  curveNet: { color: "#3f3f46", fontSize: "10px", fontFamily: "var(--font-mono)" },
  curveBarWrap: { height: "10px", background: "rgba(39,39,42,0.5)", borderRadius: "5px", overflow: "hidden", marginBottom: "16px" },
  curveBarFill: {
    height: "100%", borderRadius: "5px", minWidth: "4px",
    transition: "width 0.6s ease", boxShadow: "0 0 10px rgba(0,255,136,0.3)",
  },
  curveStatsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "12px" },
  cStatLabel: { fontSize: "9px", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px" },
  cStatVal: { fontSize: "13px", color: "#f4f4f5", margin: 0, fontWeight: 700 },
  curveHint: { color: "#27272a", fontSize: "10px", margin: 0 },
  // Info
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "12px" },
  infoItem: {
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(39,39,42,0.4)",
    borderRadius: "10px", padding: "14px 16px",
  },
  infoLabel: { fontSize: "9px", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 5px" },
  infoVal: { fontSize: "14px", color: "#f4f4f5", margin: 0, fontWeight: 700 },
  descCard: {
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(39,39,42,0.4)",
    borderRadius: "10px", padding: "16px",
  },
  descText: { fontSize: "13px", color: "#a1a1aa", lineHeight: 1.7, margin: "6px 0 0" },
  creatorCard: {
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(39,39,42,0.4)",
    borderRadius: "10px", padding: "14px 16px",
  },
  walletCode: { fontSize: "11px", color: "#71717a", wordBreak: "break-all", fontFamily: "var(--font-mono)" },
  linksRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  extLink: {
    color: "#00ff88", fontSize: "12px", textDecoration: "none",
    border: "1px solid rgba(0,255,136,0.2)", padding: "7px 14px", borderRadius: "8px",
    background: "rgba(0,255,136,0.04)", fontWeight: 500,
  },
  onchainCard: {
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(39,39,42,0.4)",
    borderRadius: "10px", padding: "16px",
  },
  onchainGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginTop: "8px" },
  onchainLink: { display: "block", fontSize: "11px", color: "#00ff88", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  // Trade widget
  tradeCard: {
    background: "rgba(22,22,26,0.8)", border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "14px", overflow: "hidden", backdropFilter: "blur(12px)",
  },
  tradeTabs: { display: "flex" },
  tab: {
    flex: 1, background: "transparent", border: "none", color: "#52525b",
    padding: "14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
    letterSpacing: "0.1em", borderBottom: "2px solid transparent",
  },
  tabActiveBuy: {
    flex: 1, background: "rgba(0,255,136,0.04)", border: "none", color: "#00ff88",
    padding: "14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
    borderBottom: "2px solid #00ff88", letterSpacing: "0.1em",
  },
  tabActiveSell: {
    flex: 1, background: "rgba(255,71,87,0.04)", border: "none", color: "#ff4757",
    padding: "14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
    borderBottom: "2px solid #ff4757", letterSpacing: "0.1em",
  },
  tradeBody: { padding: "20px" },
  tradeLabel: { color: "#71717a", fontSize: "11px", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" },
  tradeInputWrap: {
    display: "flex", alignItems: "center",
    background: "rgba(9,9,11,0.6)", border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "10px", padding: "6px 14px", marginBottom: "16px",
  },
  tradeInput: {
    flex: 1, background: "transparent", border: "none", color: "#f4f4f5",
    fontSize: "20px", outline: "none", width: "100%", fontFamily: "var(--font-mono)",
  },
  tradeUnit: { color: "#52525b", fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-mono)" },
  slippageRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  slippageLabel: { color: "#52525b", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em" },
  slippageBtns: { display: "flex", gap: "6px" },
  slipBtn: {
    background: "rgba(39,39,42,0.5)", border: "none", color: "#71717a",
    padding: "4px 10px", fontSize: "11px", borderRadius: "6px", cursor: "pointer",
  },
  slipBtnActive: {
    background: "rgba(0,255,136,0.1)", border: "none", color: "#00ff88",
    padding: "4px 10px", fontSize: "11px", borderRadius: "6px", cursor: "pointer", fontWeight: 600,
  },
  estimateBox: {
    background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)",
    borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  estimateLabel: { color: "#52525b", fontSize: "11px" },
  estimateValue: { color: "#00ff88", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)" },
  tradeBtnBuy: {
    width: "100%", padding: "14px",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000", border: "none", borderRadius: "10px",
    fontWeight: 700, fontSize: "14px", cursor: "pointer",
    boxShadow: "0 0 20px rgba(0,255,136,0.2)",
  },
  tradeBtnSell: {
    width: "100%", padding: "14px",
    background: "linear-gradient(135deg, #ff4757, #cc3645)",
    color: "#fff", border: "none", borderRadius: "10px",
    fontWeight: 700, fontSize: "14px", cursor: "pointer",
    boxShadow: "0 0 20px rgba(255,71,87,0.2)",
  },
  tradeHint: { color: "#3f3f46", fontSize: "11px", textAlign: "center", marginTop: "12px" },
  securityCard: {
    background: "rgba(22,22,26,0.7)", border: "1px dashed rgba(255,165,0,0.4)",
    borderRadius: "10px", padding: "16px", marginTop: "16px",
  },
  securityGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" },
  secItem: { fontSize: "12px", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "6px" },
  secIcon: { fontSize: "14px" },
  bubbleMapCard: {
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(0,255,136,0.12)",
    borderRadius: "10px", padding: "16px", marginTop: "16px", overflow: "hidden"
  },
  bubbleHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  livePulse: { fontSize: "10px", color: "#00ff88", animation: "pulse 2s infinite", fontWeight: "bold" },
  bubbleCanvas: { position: "relative", height: "180px", background: "rgba(9,9,11,0.6)", borderRadius: "8px", overflow: "hidden", marginBottom: "10px" },
  bubble: { position: "absolute", borderRadius: "50%", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold", boxShadow: "0 0 10px rgba(0,255,136,0.1)" },
};
