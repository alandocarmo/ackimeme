import Head from "next/head";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { getPublicLaunches } from "../lib/api";

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function compactWallet(w) {
  const s = String(w || "");
  return s.length <= 14 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
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

function calcProgressFromReserve(reserveBalance) {
  if (!Number.isFinite(reserveBalance)) {
    return null;
  }
  return Math.min((reserveBalance / MIGRATION_THRESHOLD) * 100, 100).toFixed(1);
}

function matchesSearch(launch, q) {
  if (!q) return true;
  const hay = [launch.coin?.name, launch.coin?.symbol, launch.coin?.tagline, launch.creatorWallet].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

// Generate a consistent color from a string
function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

export default function Home() {
  const [launches, setLaunches] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("new"); // new | trending | finishing
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    getPublicLaunches()
      .then((r) => { setLaunches(r.launches || []); setError(""); })
      .catch((e) => setError(e.message));

    const interval = setInterval(() => {
      getPublicLaunches()
        .then((r) => { setLaunches(r.launches || []); })
        .catch(() => {});
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  let filtered = launches.filter((l) => matchesSearch(l, deferredSearch));

  // Sort by filter
  if (filter === "trending") {
    filtered = [...filtered].sort((a, b) => (b.riskProfile?.score || 0) - (a.riskProfile?.score || 0));
  } else if (filter === "finishing") {
    filtered = [...filtered].sort((a, b) => {
      const pa = parseFloat(calcProgressFromReserve(readReserveBalance(a.onchainData)) || "0");
      const pb = parseFloat(calcProgressFromReserve(readReserveBalance(b.onchainData)) || "0");
      return pb - pa;
    });
  }

  return (
    <>
      <Head>
        <title>AckiMeme — Memecoin Launchpad on Acki Nacki</title>
        <meta name="description" content="Create and trade memecoins with bonding curves on Acki Nacki blockchain. Fair launch, no rugs." />
      </Head>

      <main style={s.page}>
        {/* Hero */}
        <section style={s.hero}>
          <div style={s.heroGlow} />
          <h1 style={s.heroTitle}>
            the memecoin launchpad<br />
            <span style={s.heroAccent}>on Acki Nacki</span>
          </h1>
          <p style={s.heroSub}>
            fair launch · bonding curve · auto-migrate to DEX.DO at 69K SHELL
          </p>
          <Link href="/create" style={s.heroCta}>
            🚀 Launch your coin
          </Link>
        </section>

        {/* Controls */}
        <section style={s.controls}>
          <div style={s.filterRow}>
            {["new", "trending", "finishing"].map((f) => (
              <button
                key={f}
                style={filter === f ? s.filterActive : s.filterBtn}
                onClick={() => setFilter(f)}
              >
                {f === "new" ? "🕐 New" : f === "trending" ? "🔥 Trending" : "🏁 Finishing"}
              </button>
            ))}
          </div>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>🔍</span>
            <input
              style={s.searchInput}
              placeholder="Search by name, ticker, or wallet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span style={s.count}>{filtered.length} tokens</span>
        </section>

        {/* Feed */}
        {error && <p style={s.errorMsg}>{error}</p>}
        {!error && filtered.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyIcon}>⬡</p>
            <p style={s.emptyText}>No tokens found. Be the first to launch!</p>
            <Link href="/create" style={s.emptyBtn}>Create a coin</Link>
          </div>
        )}

        <div style={s.grid}>
          {filtered.map((launch, i) => {
            const reserveBalance = readReserveBalance(launch.onchainData);
            const progress = calcProgressFromReserve(reserveBalance);
            const color = hashColor(launch.coin?.symbol);
            return (
              <Link href={`/token/${launch.id}`} key={launch.id} style={{ textDecoration: "none" }}>
                <article style={{ ...s.card, animationDelay: `${i * 40}ms` }}>
                  {/* Token badge */}
                  <div style={s.cardTop}>
                    <div style={{ ...s.tokenIcon, background: `linear-gradient(135deg, ${color}, ${color}44)` }}>
                      {launch.coin?.logoUrl ? (
                        <img src={launch.coin.logoUrl} alt="" style={s.tokenImg} />
                      ) : (
                        <span style={s.tokenLetter}>{(launch.coin?.symbol || "?")[0]}</span>
                      )}
                    </div>
                    <div style={s.cardIdent}>
                      <div style={s.tickerRow}>
                        <span style={s.ticker}>${launch.coin?.symbol}</span>
                        <span style={s.timeAgo}>{formatTimeAgo(launch.createdAt)}</span>
                      </div>
                      <p style={s.coinName}>{launch.coin?.name}</p>
                    </div>
                  </div>

                  {/* Tagline */}
                  <p style={s.tagline}>
                    {(launch.coin?.tagline || launch.coin?.description || "").slice(0, 80)}
                    {(launch.coin?.tagline || launch.coin?.description || "").length > 80 ? "…" : ""}
                  </p>

                  {/* Progress bar */}
                  <div style={s.progressWrap}>
                    <div style={s.progressTrack}>
                      <div style={{
                        ...s.progressFill,
                        width: progress === null ? "0%" : `${progress}%`,
                        minWidth: progress === null ? "0px" : s.progressFill.minWidth,
                        opacity: progress === null ? 0 : 1,
                        background: parseFloat(progress || "0") > 80
                          ? "linear-gradient(90deg, #f97316, #ef4444)"
                          : "linear-gradient(90deg, #00ff88, #00cc6d)",
                      }} />
                    </div>
                    <span style={s.progressLabel}>{progress === null ? "N/A" : `${progress}%`}</span>
                  </div>

                  {/* Stats */}
                  <div style={s.statsRow}>
                    <div style={s.stat}>
                      <span style={s.statLabel}>reserve</span>
                      <span style={s.statValue}>
                        {reserveBalance === null ? "on-chain pending" : `${reserveBalance.toFixed(2)} SHELL`}
                      </span>
                    </div>
                    <div style={s.stat}>
                      <span style={s.statLabel}>supply</span>
                      <span style={s.statValue}>{formatSupply(launch.coin?.totalSupply)}</span>
                    </div>
                    <div style={s.stat}>
                      <span style={s.statLabel}>by</span>
                      <span style={{ ...s.statValue, fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                        {compactWallet(launch.creatorWallet)}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    padding: "0 0 80px",
  },
  // Hero
  hero: {
    position: "relative",
    textAlign: "center",
    padding: "60px 24px 40px",
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: "-100px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "600px",
    height: "400px",
    background: "radial-gradient(ellipse, rgba(0,255,136,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  heroTitle: {
    fontSize: "clamp(28px, 5vw, 44px)",
    fontWeight: 700,
    color: "#f4f4f5",
    lineHeight: 1.15,
    margin: "0 0 14px",
    letterSpacing: "-0.03em",
    position: "relative",
  },
  heroAccent: {
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    color: "#71717a",
    fontSize: "14px",
    margin: "0 0 28px",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.02em",
    position: "relative",
  },
  heroCta: {
    display: "inline-block",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000",
    fontWeight: 700,
    fontSize: "15px",
    padding: "12px 32px",
    borderRadius: "10px",
    textDecoration: "none",
    boxShadow: "0 0 30px rgba(0,255,136,0.25), 0 4px 12px rgba(0,0,0,0.3)",
    transition: "transform 0.15s, box-shadow 0.2s",
    position: "relative",
  },
  // Controls
  controls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "0 24px",
    maxWidth: "1200px",
    margin: "0 auto 24px",
    flexWrap: "wrap",
  },
  filterRow: {
    display: "flex",
    gap: "6px",
  },
  filterBtn: {
    background: "rgba(39,39,42,0.4)",
    border: "1px solid rgba(39,39,42,0.6)",
    color: "#71717a",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.15s",
    fontWeight: 500,
  },
  filterActive: {
    background: "rgba(0,255,136,0.08)",
    border: "1px solid rgba(0,255,136,0.25)",
    color: "#00ff88",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    background: "rgba(39,39,42,0.3)",
    border: "1px solid rgba(39,39,42,0.6)",
    borderRadius: "8px",
    padding: "0 12px",
    flex: "1 1 200px",
    maxWidth: "360px",
  },
  searchIcon: {
    fontSize: "12px",
    marginRight: "8px",
    opacity: 0.5,
  },
  searchInput: {
    background: "transparent",
    border: "none",
    color: "#f4f4f5",
    fontSize: "13px",
    padding: "8px 0",
    width: "100%",
    fontFamily: "var(--font-sans)",
  },
  count: {
    color: "#3f3f46",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    whiteSpace: "nowrap",
  },
  // Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
    padding: "0 24px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  card: {
    background: "rgba(22,22,26,0.7)",
    border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "12px",
    padding: "18px",
    cursor: "pointer",
    transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
    backdropFilter: "blur(8px)",
    animation: "fadeInUp 0.4s ease both",
    position: "relative",
    overflow: "hidden",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  tokenIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  tokenImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "10px",
  },
  tokenLetter: {
    color: "#fff",
    fontSize: "18px",
    fontWeight: 700,
    textShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  cardIdent: {
    flex: 1,
    minWidth: 0,
  },
  tickerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  ticker: {
    color: "#00ff88",
    fontSize: "15px",
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
  },
  timeAgo: {
    color: "#3f3f46",
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
  },
  coinName: {
    color: "#a1a1aa",
    fontSize: "13px",
    margin: "2px 0 0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagline: {
    color: "#52525b",
    fontSize: "12px",
    lineHeight: 1.5,
    margin: "0 0 14px",
    minHeight: "36px",
  },
  // Progress
  progressWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
  },
  progressTrack: {
    flex: 1,
    height: "8px",
    background: "rgba(39,39,42,0.5)",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    minWidth: "4px",
    transition: "width 0.6s ease",
    boxShadow: "0 0 8px rgba(0,255,136,0.3)",
  },
  progressLabel: {
    color: "#71717a",
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    minWidth: "36px",
    textAlign: "right",
  },
  // Stats
  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  statLabel: {
    color: "#3f3f46",
    fontSize: "9px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontFamily: "var(--font-mono)",
  },
  statValue: {
    color: "#a1a1aa",
    fontSize: "11px",
    fontWeight: 600,
  },
  // Empty
  empty: {
    textAlign: "center",
    padding: "80px 24px",
  },
  emptyIcon: {
    fontSize: "48px",
    color: "#27272a",
    margin: "0 0 12px",
  },
  emptyText: {
    color: "#52525b",
    fontSize: "14px",
    margin: "0 0 20px",
  },
  emptyBtn: {
    display: "inline-block",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000",
    fontWeight: 600,
    fontSize: "13px",
    padding: "10px 24px",
    borderRadius: "8px",
    textDecoration: "none",
  },
  errorMsg: {
    color: "#ff4757",
    textAlign: "center",
    padding: "40px 24px",
    fontSize: "13px",
  },
};
