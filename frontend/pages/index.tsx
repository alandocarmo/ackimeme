import Head from "next/head";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { getPublicLaunches, getSocket, searchLaunches, getGlobalStats } from "../lib/api";
import { formatNum, formatSupply, compactWallet, isSafeUrl, calcBondingStats, hashColor, MIGRATION_THRESHOLD_NANO } from "../lib/utils";
import { useI18n } from "../lib/i18n";
import styles from "../styles/Home.module.css";
import { Launch } from "../types";
import { SEO } from "../components/SEO";
import { Skeleton } from "../components/ui/Skeleton";
import { KingOfTheHill } from "../components/ui/KingOfTheHill";

function formatDate(date: string | number | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(dateStr: string, t: (key: string) => string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time_just_now");
  if (mins < 60) return `${mins}${t("time_m_ago")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("time_h_ago")}`;
  const days = Math.floor(hrs / 24);
  return `${days}${t("time_d_ago")}`;
}

function matchesSearch(launch: Launch, q: string): boolean {
  if (!q) return true;
  const hay = [launch.coin?.name, launch.coin?.symbol, launch.coin?.tagline, launch.creatorWallet].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}



function computeAggregateStats(launches: Launch[]) {
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
    activeWallets: 0,
  };
}

export default function Home() {
  const { t } = useI18n();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [searchResults, setSearchResults] = useState<Launch[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<string>("new"); // new | trending | finishing | hall_of_fame
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    getPublicLaunches()
      .then((r) => { setLaunches(r.launches || []); setError(""); setIsLoading(false); })
      .catch((e) => { setError(e.message); setIsLoading(false); });

    const socket = getSocket();
    if (!socket) return;

    const handleNewLaunch = (launch: Launch) => {
      setLaunches((prev) => {
        // Prevent duplicates
        if (prev.find((l) => l.id === launch.id)) return prev;
        return [launch, ...prev];
      });
    };

    const handleTokenUpdated = (update: Partial<import("../types").Launch>) => {
      setLaunches((prev) =>
        prev.map((l) => {
          if (l.id === update.id) {
            return {
              ...l,
              status: update.status || l.status,
              onchainData: {
                ...l.onchainData,
                reserveBalance: update.onchainData?.reserveBalance ?? l.onchainData?.reserveBalance,
                tokenSupply: update.onchainData?.tokenSupply ?? l.onchainData?.tokenSupply,
                lockedLiquidity: update.onchainData?.lockedLiquidity ?? l.onchainData?.lockedLiquidity,
                updatedAt: update.onchainData?.updatedAt ?? l.onchainData?.updatedAt,
              },
            };
          }
          return l;
        })
      );
    };

    socket.on("new_launch", handleNewLaunch);
    socket.on("token_updated", handleTokenUpdated);

    return () => {
      socket.off("new_launch", handleNewLaunch);
      socket.off("token_updated", handleTokenUpdated);
    };
  }, []);

  // Server-side search logic
  useEffect(() => {
    if (!deferredSearch) {
      setSearchResults(null);
      return;
    }
    searchLaunches(deferredSearch)
      .then((r) => {
        setSearchResults(r.launches || []);
      })
      .catch((e) => {
        console.error("Search error", e);
        setSearchResults([]); // Fallback to empty list so user knows it failed
      });
  }, [deferredSearch]);

  // Global stats fetch — runs once on mount, not on every launch update
  useEffect(() => {
    getGlobalStats()
      .then((r) => setStats(r.stats))
      .catch((e) => console.error("Global stats error", e));
  }, []);

  let filtered = searchResults !== null
    ? searchResults
    : launches.filter((l) => matchesSearch(l, deferredSearch));

  const isBoostedActive = (l: Launch) => l.protocol?.isBoosted && (Date.now() - new Date(l.createdAt || Date.now()).getTime() < 24 * 60 * 60 * 1000);

  // Sort by filter
  filtered = [...filtered].sort((a, b) => {
    const aBoost = isBoostedActive(a) ? 1 : 0;
    const bBoost = isBoostedActive(b) ? 1 : 0;
    
    // Boosted tokens always at the top of their respective lists
    if (aBoost !== bBoost) return bBoost - aBoost;

    if (filter === "trending" || filter === "hall_of_fame") {
      return Number(b.onchainData?.reserveBalance || 0) - Number(a.onchainData?.reserveBalance || 0);
    } else if (filter === "finishing") {
      const pa = calcBondingStats(a.onchainData).progress;
      const pb = calcBondingStats(b.onchainData).progress;
      return pb - pa;
    }
    
    // "new" (default) sorting
    return new Date(b.createdAt || Date.now()).getTime() - new Date(a.createdAt || Date.now()).getTime();
  });

  return (
    <>
      <SEO />

      <main className="page-wrapper">
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles['hero-glow']} />
          <h1 className={styles['hero-title']}>
            {t("hero_title_1")}<br />
            <span className={styles['hero-accent']}>{t("hero_title_2")}</span>
          </h1>
          <p className={styles['hero-subtitle']}>
            {t("hero_subtitle")}
          </p>
          <Link href="/create" className="btn-primary">
            {t("hero_cta")}
          </Link>
        </section>

        {/* King of the Hill */}
        <div className="container">
          <KingOfTheHill kingToken={
            // Find the token with highest reserve that hasn't migrated
            launches
              .filter(l => Number(l.onchainData?.reserveBalance || 0) < 6900000000000000)
              .sort((a, b) => Number(b.onchainData?.reserveBalance || 0) - Number(a.onchainData?.reserveBalance || 0))[0] || null
          } />
        </div>

        {/* Live Stats Banner */}
        {(stats || launches.length > 0) && (() => {
          const agg = stats || computeAggregateStats(launches);
          return (
            <div className="container">
              <div className={styles['stats-banner']}>
                <div className={styles['stats-banner-item']}>
                  <span className={styles['stats-banner-value']}><span className={styles.accent}>{agg.totalTokens}</span></span>
                  <span className={styles['stats-banner-label']}>{t("stats_tokens_launched")}</span>
                </div>
                <div className={styles['stats-banner-item']}>
                  <span className={styles['stats-banner-value']}><span className={styles.cyan}>{agg.totalReserveShell}</span></span>
                  <span className={styles['stats-banner-label']}>{t("stats_shell_locked")}</span>
                </div>
                <div className={styles['stats-banner-item']}>
                  <span className={styles['stats-banner-value']}><span className={styles.warm}>{stats ? agg.activeWallets : agg.activeTrading}</span></span>
                  <span className={styles['stats-banner-label']}>{stats ? "Active Traders" : t("stats_active_trading")}</span>
                </div>
                <div className={styles['stats-banner-item']}>
                  <span className={styles['stats-banner-value']}><span className={styles.purple}>●</span></span>
                  <span className={styles['stats-banner-label']}>{t("stats_live")}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Activity Ticker */}
        {launches.length > 0 && (
          <div className={styles['activity-ticker']}>
            <div className={styles['ticker-track']}>
              {/* Duplicate items for seamless loop */}
              {[...launches, ...launches].slice(0, 20).map((l, i) => (
                <span className={styles['ticker-item']} key={`tick-${l.id}-${i}`}>
                  <span className={styles['ticker-dot']} />
                  <span className={`${styles['ticker-action']} ${styles['ticker-launch']}`}>LAUNCHED</span>
                  <span>${l.coin?.symbol}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{formatTimeAgo(l.createdAt || "", t)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="container">
          <section className={styles['controls-row']}>
            <div className={styles['filter-group']}>
              {["new", "trending", "finishing", "hall_of_fame"].map((f) => (
                <button
                  key={f}
                  className={`${styles['filter-btn']} ${filter === f ? styles.active : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "new" ? t("filter_new") : f === "trending" ? t("filter_trending") : f === "finishing" ? t("filter_finishing") : t("filter_hall_of_fame")}
                </button>
              ))}
            </div>
            
            <div className={styles['search-field']}>
              <span className={styles['search-icon']}>🔍</span>
              <input
                className={styles['search-input']}
                placeholder={t("search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <span className={styles['token-time']}>{filtered.length} tokens found</span>
          </section>

          {/* Feed */}
          {error && <p className={styles['error-msg']}>{error}</p>}
          {!error && !isLoading && filtered.length === 0 && (
            <div className={styles['empty-state']}>
              <p className={styles['empty-icon']}>⬡</p>
              <p className={styles['empty-text']}>{t("card_no_tokens")}</p>
              <Link href="/create" className="btn-primary" style={{ padding: '10px 24px', fontSize: '13px' }}>{t("nav_create")}</Link>
            </div>
          )}

          <div className={styles['token-grid']}>
            {isLoading && launches.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <article key={`skel-${i}`} className={`neon-card ${styles['token-card']}`}>
                  <div className={styles['token-card-header']}>
                    <Skeleton width="48px" height="48px" borderRadius="12px" />
                    <div className={styles['token-meta']} style={{ flex: 1, gap: '8px', display: 'flex', flexDirection: 'column' }}>
                      <Skeleton width="60%" height="20px" />
                      <Skeleton width="40%" height="14px" />
                    </div>
                  </div>
                  <div className={styles['token-body']} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Skeleton width="100%" height="14px" />
                    <Skeleton width="80%" height="14px" />
                  </div>
                </article>
              ))
            ) : filtered.map((launch, i) => {
              const stats = calcBondingStats(launch.onchainData);
              const progress = stats.progress ? stats.progress.toFixed(1) : null;
              const color = hashColor(launch.coin?.symbol);
              return (
                <Link href={`/token/${launch.id}`} key={launch.id} style={{ textDecoration: "none" }}>
                  <article className={`neon-card ${styles['token-card']} ${isBoostedActive(launch) ? styles['card-boosted'] : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <div className={styles['token-card-header']}>
                      <div className={styles['token-avatar']} style={{ background: `linear-gradient(135deg, ${color}, ${color}44)` }}>
                        {isSafeUrl(launch.coin?.logoUrl) ? (
                          <img src={launch.coin!.logoUrl!} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>
                            {(launch.coin?.symbol || "?")[0]}
                          </span>
                        )}
                      </div>
                      <div className={styles['token-meta']}>
                        <div className={styles['token-ticker-row']}>
                          <span className={styles['token-ticker']}>${launch.coin?.symbol}</span>
                          <span className={styles.timeTag}>{formatDate(launch.createdAt || Date.now())}</span>
                          {isBoostedActive(launch) && (
                            <span className={styles['badge-boosted']}>🚀 {t("card_boosted")}</span>
                          )}
                          {launch.protocol?.pumpForever && stats.reserveBalance && stats.reserveBalance >= MIGRATION_THRESHOLD_NANO && (
                            <span className={styles['king-badge']}>👑 {t("card_pump_forever")}</span>
                          )}
                          {launch.status === 'on_chain_deployed' && (
                            <span className={styles['badge-live']} style={{
                              background: launch.onchainData?.updatedAt && (Date.now() - new Date(launch.onchainData.updatedAt).getTime() < 120000) ? 'rgba(0,255,136,0.2)' : 'rgba(255,165,0,0.2)',
                              color: launch.onchainData?.updatedAt && (Date.now() - new Date(launch.onchainData.updatedAt).getTime() < 120000) ? '#00ff88' : '#ffa500'
                            }}>
                              {launch.onchainData?.updatedAt && (Date.now() - new Date(launch.onchainData.updatedAt).getTime() < 120000) ? '● Live' : '↻ Syncing...'}
                            </span>
                          )}
                          {!launch.protocol?.pumpForever && parseFloat(progress || "0") > 80 && (
                            <span className={styles['badge-finishing']}>🔥 Almost there!</span>
                          )}
                        </div>
                        <p className={styles['token-name']}>{launch.coin?.name}</p>
                      </div>
                    </div>

                    <p className={styles['token-tagline']}>
                      {(launch.coin?.tagline || launch.coin?.description || "").slice(0, 80)}
                      {(launch.coin?.tagline || launch.coin?.description || "").length > 80 ? "…" : ""}
                    </p>

                    {launch.protocol?.pumpForever ? (
                      <div className={styles['progress-bar']}>
                        <div className={styles['progress-header']}>
                          <span>Mode</span>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>{t("card_pump_forever")}</span>
                        </div>
                        <div className={styles['progress-track']}>
                          <div className={styles['progress-fill']} style={{
                            width: '100%',
                            background: 'linear-gradient(90deg, #ef4444, #f97316)',
                            opacity: 0.4,
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div className={styles['progress-bar']}>
                        <div className={styles['progress-header']}>
                          <span>{t("card_progress")}</span>
                          <span>{progress === null ? "N/A" : `${progress}%`}</span>
                        </div>
                        <div className={styles['progress-track']}>
                          <div className={`${styles['progress-fill']} ${parseFloat(progress || "0") > 80 ? styles['near-complete'] : ""}`} style={{
                            width: progress === null ? "0%" : `${progress}%`,
                            background: parseFloat(progress || "0") > 80
                              ? "linear-gradient(90deg, #f97316, #ef4444)"
                              : "linear-gradient(90deg, #00ff88, #00cc6d)",
                          }} />
                        </div>
                      </div>
                    )}

                    <div className={styles['token-stats']}>
                      <div className={styles['stat-box']}>
                        <span className="info-value">{new Date(launch.createdAt || Date.now()).toLocaleDateString()}</span>
                        <span className={styles['stat-value']}>
                          {stats.reserveBalance === null ? "on-chain pending" : `${(stats.reserveBalance / 1e9).toFixed(2)} ${t("common_shell")}`}
                        </span>
                      </div>
                      <div className={styles['stat-box']}>
                        <span className={styles['stat-label']}>{t("card_supply")}</span>
                        <span className={styles['stat-value']}>{formatSupply(launch.onchainData?.tokenSupply || launch.coin?.totalSupply, !!launch.onchainData?.tokenSupply)}</span>
                      </div>
                      <div className={styles['stat-box']}>
                        <span className={styles['stat-label']}>{t("card_by")}</span>
                        <span className={styles['stat-value']} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
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
    </>
  );
}

