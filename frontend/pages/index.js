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

const MIGRATION_THRESHOLD_NANO = 15_000_000_000_000; // 15K SHELL in nano (contract uses nano)

function readReserveBalance(onchainData) {
  const parsed = Number(onchainData?.reserveBalance);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed; // returns nano-SHELL
}

function calcProgressFromReserve(reserveNano) {
  if (!Number.isFinite(reserveNano)) {
    return null;
  }
  return Math.min((reserveNano / MIGRATION_THRESHOLD_NANO) * 100, 100).toFixed(1);
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

function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function computeAggregateStats(launches) {
  let totalReserve = 0;
  let activeCount = 0;
  for (const l of launches) {
    const r = Number(l.onchainData?.reserveBalance || 0);
    if (r > 0) {
      totalReserve += r;
      activeCount++;
    }
  }
  return {
    totalTokens: launches.length,
    totalReserveShell: (totalReserve / 1e9).toFixed(1),
    activeTrading: activeCount,
  };
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

    let interval = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        getPublicLaunches()
          .then((r) => { setLaunches(r.launches || []); })
          .catch(() => {});
      }, 12000);
    };

    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    // Pausar polling quando a aba não está visível (economiza bateria no Telegram WebApp)
    const handleVisibility = () => {
      if (document.hidden) { stopPolling(); } else { startPolling(); }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  let filtered = launches.filter((l) => matchesSearch(l, deferredSearch));

  const isBoostedActive = (l) => l.protocol?.isBoosted && (Date.now() - new Date(l.createdAt).getTime() < 24 * 60 * 60 * 1000);

  // Sort by filter
  filtered = [...filtered].sort((a, b) => {
    const aBoost = isBoostedActive(a) ? 1 : 0;
    const bBoost = isBoostedActive(b) ? 1 : 0;
    
    // Boosted tokens always at the top of their respective lists
    if (aBoost !== bBoost) return bBoost - aBoost;

    if (filter === "trending" || filter === "hall_of_fame") {
      return Number(b.onchainData?.reserveBalance || 0) - Number(a.onchainData?.reserveBalance || 0);
    } else if (filter === "finishing") {
      const pa = parseFloat(calcProgressFromReserve(readReserveBalance(a.onchainData)) || "0");
      const pb = parseFloat(calcProgressFromReserve(readReserveBalance(b.onchainData)) || "0");
      return pb - pa;
    }
    
    // "new" (default) sorting
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
      <Head>
        <title>AckiMeme — Memecoin Launchpad on Acki Nacki</title>
        <meta name="description" content="Create and trade memecoins with bonding curves on Acki Nacki blockchain. Fair launch, no rugs." />
      </Head>

      <main className="page-wrapper">
        {/* Hero */}
        <section className="hero">
          <div className="hero-glow" />
          <h1 className="hero-title">
            the memecoin launchpad<br />
            <span className="hero-accent">on Acki Nacki</span>
          </h1>
          <p className="hero-subtitle">
            fair launch · bonding curve · auto-migrate to AMM at 15K SHELL
          </p>
          <Link href="/create" className="btn-primary">
            🚀 Launch your coin
          </Link>
        </section>

        {/* Live Stats Banner */}
        {launches.length > 0 && (() => {
          const agg = computeAggregateStats(launches);
          return (
            <div className="container">
              <div className="stats-banner">
                <div className="stats-banner-item">
                  <span className="stats-banner-value"><span className="accent">{agg.totalTokens}</span></span>
                  <span className="stats-banner-label">Tokens Launched</span>
                </div>
                <div className="stats-banner-item">
                  <span className="stats-banner-value"><span className="cyan">{agg.totalReserveShell}</span></span>
                  <span className="stats-banner-label">SHELL Locked</span>
                </div>
                <div className="stats-banner-item">
                  <span className="stats-banner-value"><span className="warm">{agg.activeTrading}</span></span>
                  <span className="stats-banner-label">Active Trading</span>
                </div>
                <div className="stats-banner-item">
                  <span className="stats-banner-value"><span className="purple">●</span></span>
                  <span className="stats-banner-label">Acki Nacki Live</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Activity Ticker */}
        {launches.length > 0 && (
          <div className="activity-ticker">
            <div className="ticker-track">
              {/* Duplicate items for seamless loop */}
              {[...launches, ...launches].slice(0, 20).map((l, i) => (
                <span className="ticker-item" key={`tick-${i}`}>
                  <span className="ticker-dot" />
                  <span className="ticker-action ticker-launch">LAUNCHED</span>
                  <span>${l.coin?.symbol}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{formatTimeAgo(l.createdAt)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="container">
          <section className="controls-row">
            <div className="filter-group">
              {["new", "trending", "finishing", "hall_of_fame"].map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "new" ? "🕐 New" : f === "trending" ? "🔥 Trending" : f === "finishing" ? "🏁 Finishing" : "🏆 Hall of Fame"}
                </button>
              ))}
            </div>
            
            <div className="search-field">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Search by name, ticker, or wallet…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <span className="token-time">{filtered.length} tokens found</span>
          </section>

          {/* Feed */}
          {error && <p className="error-msg">{error}</p>}
          {!error && filtered.length === 0 && (
            <div className="empty-state">
              <p className="empty-icon">⬡</p>
              <p className="empty-text">No tokens found. Be the first to launch!</p>
              <Link href="/create" className="btn-primary" style={{ padding: '10px 24px', fontSize: '13px' }}>Create a coin</Link>
            </div>
          )}

          <div className="token-grid">
            {filtered.map((launch, i) => {
              const reserveBalance = readReserveBalance(launch.onchainData);
              const progress = calcProgressFromReserve(reserveBalance);
              const color = hashColor(launch.coin?.symbol);
              return (
                <Link href={`/token/${launch.id}`} key={launch.id} style={{ textDecoration: "none" }}>
                  <article className={`token-card ${isBoostedActive(launch) ? 'card-boosted' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="token-card-header">
                      <div className="token-avatar" style={{ background: `linear-gradient(135deg, ${color}, ${color}44)` }}>
                        {isSafeUrl(launch.coin?.logoUrl) ? (
                          <img src={launch.coin.logoUrl} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>
                            {(launch.coin?.symbol || "?")[0]}
                          </span>
                        )}
                      </div>
                      <div className="token-meta">
                        <div className="token-ticker-row">
                          <span className="token-ticker">${launch.coin?.symbol}</span>
                          <span className="token-time">{formatTimeAgo(launch.createdAt)}</span>
                          {isBoostedActive(launch) && (
                            <span className="badge-boosted">🚀 Boosted</span>
                          )}
                          {launch.protocol?.pumpForever && reserveBalance >= 15000000000000 && (
                            <span className="king-badge">👑 Eternal Pump King</span>
                          )}
                          {launch.status === 'on_chain_deployed' && (
                            <span className="badge-live" style={{
                              marginLeft: '8px', 
                              fontSize: '10px', 
                              padding: '2px 6px', 
                              borderRadius: '12px',
                              background: launch.onchainData?.updatedAt && (Date.now() - new Date(launch.onchainData.updatedAt).getTime() < 120000) ? 'rgba(0,255,136,0.2)' : 'rgba(255,165,0,0.2)',
                              color: launch.onchainData?.updatedAt && (Date.now() - new Date(launch.onchainData.updatedAt).getTime() < 120000) ? '#00ff88' : '#ffa500'
                            }}>
                              {launch.onchainData?.updatedAt && (Date.now() - new Date(launch.onchainData.updatedAt).getTime() < 120000) ? '● Live' : '↻ Syncing...'}
                            </span>
                          )}
                          {!launch.protocol?.pumpForever && parseFloat(progress || "0") > 80 && (
                            <span className="badge-finishing">🔥 Almost there!</span>
                          )}
                        </div>
                        <p className="token-name">{launch.coin?.name}</p>
                      </div>
                    </div>

                    <p className="token-tagline">
                      {(launch.coin?.tagline || launch.coin?.description || "").slice(0, 80)}
                      {(launch.coin?.tagline || launch.coin?.description || "").length > 80 ? "…" : ""}
                    </p>

                    {launch.protocol?.pumpForever ? (
                      <div className="progress-bar">
                        <div className="progress-header">
                          <span>Mode</span>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>♾️ Pump Forever</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{
                            width: '100%',
                            background: 'linear-gradient(90deg, #ef4444, #f97316)',
                            opacity: 0.4,
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div className="progress-bar">
                        <div className="progress-header">
                          <span>Progress</span>
                          <span>{progress === null ? "N/A" : `${progress}%`}</span>
                        </div>
                        <div className="progress-track">
                          <div className={`progress-fill${parseFloat(progress || "0") > 80 ? " near-complete" : ""}`} style={{
                            width: progress === null ? "0%" : `${progress}%`,
                            background: parseFloat(progress || "0") > 80
                              ? "linear-gradient(90deg, #f97316, #ef4444)"
                              : "linear-gradient(90deg, #00ff88, #00cc6d)",
                          }} />
                        </div>
                      </div>
                    )}

                    <div className="token-stats">
                      <div className="stat-box">
                        <span className="stat-label">reserve</span>
                        <span className="stat-value">
                          {reserveBalance === null ? "on-chain pending" : `${(reserveBalance / 1e9).toFixed(2)} SHELL`}
                        </span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">supply</span>
                        <span className="stat-value">{formatSupply(launch.onchainData?.tokenSupply || launch.coin?.totalSupply)}</span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">by</span>
                        <span className="stat-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {compactWallet(launch.creatorWallet)}
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-brand">
          <span className="footer-brand-icon">⬡</span>
          <span className="footer-brand-text">AckiMeme</span>
        </div>
        <p className="footer-tagline">fair launch memecoins on acki nacki blockchain</p>
        <div className="footer-links">
          <a href="https://docs.ackinacki.com" target="_blank" rel="noreferrer" className="footer-link">Acki Nacki Docs</a>
          <a href="https://beescan.live" target="_blank" rel="noreferrer" className="footer-link">BeeScan Explorer</a>
          <Link href="/create" className="footer-link" style={{ color: 'var(--accent)' }}>Launch a Coin</Link>
        </div>
      </footer>
      
      <style jsx>{`
        .empty-state { text-align: center; padding: 80px 24px; }
        .empty-icon { font-size: 48px; color: var(--line); margin-bottom: 12px; }
        .empty-text { color: var(--ink-muted); margin-bottom: 24px; }
        .error-msg { color: var(--red); text-align: center; padding: 40px; }
      `}</style>
    </>
  );
}

