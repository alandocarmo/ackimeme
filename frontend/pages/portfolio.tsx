import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { getSession, getPublicLaunches } from "../lib/api";
import { TokenRootAbi, TokenWalletAbi } from "../lib/abi";
import { TypedContract, TokenRootMethods, TokenWalletMethods } from "../types/contracts";
import { useI18n } from "../lib/i18n";
import { formatNum, compactWallet, isSafeUrl, nanoToDecimal } from "../lib/utils";
import { Session } from "../types";
import styles from "../styles/Portfolio.module.css";
import createStyles from "../styles/Create.module.css";

export default function PortfolioPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [launches, setLaunches] = useState<import("../types").Launch[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [noProvider, setNoProvider] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<string>("holdings"); // holdings | watchlist | ackipoints
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession()
      .then((r) => setSession(r.session))
      .catch(() => {});
    
    getPublicLaunches()
      .then((r) => { setLaunches(r.launches || []); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    const { getFavorites } = require("../lib/api");
    getFavorites()
      .then((r: { launches?: import("../types").Launch[] }) => setFavorites(r.launches || []))
      .catch(() => {});
  }, [session]);

  const scanBalances = useCallback(async () => {
    if (!session || launches.length === 0) return;
    setScanning(true);
    setNoProvider(false);
    try {
      const { getEver } = await import('../lib/ever');
      let ever;
      try {
        ever = await getEver();
      } catch (e) {
        setNoProvider(true);
        return;
      }
      const { Address } = await import('everscale-inpage-provider');

      const deployedLaunches = launches.filter((l: import("../types").Launch) => l.onchainData?.tokenRootAddress);

      // Scan in parallel batches of 5 instead of sequentially
      const BATCH_SIZE = 10;
      const foundHoldings: any[] = []; // Reverted because the logic maps the entire launch ticket later
      const address = session.walletAddress;

      for (let i = 0; i < deployedLaunches.length; i += BATCH_SIZE) {
        const batch = deployedLaunches.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(async (launch) => {
          if (!launch.onchainData?.tokenRootAddress) return null;
          const cacheKey = `walletOf_${(launch.onchainData?.tokenRootAddress || "")}_${address}`;
          let userWalletAddress = localStorage.getItem(cacheKey);

          if (!userWalletAddress) {
            const rootContract = new ever.Contract(TokenRootAbi, new Address((launch.onchainData?.tokenRootAddress || ""))) as unknown as TypedContract<TokenRootMethods>;
            const walletResult = await rootContract.methods.getWalletAddress({
              ownerAddress: new Address(address)
            }).call();
            userWalletAddress = walletResult.walletAddress.toString();
            
            if (userWalletAddress && userWalletAddress !== "0:0000000000000000000000000000000000000000000000000000000000000000") {
               localStorage.setItem(cacheKey, JSON.stringify({ address: userWalletAddress, timestamp: Date.now() }));
            }
          } else {
            try {
              const parsedCache = JSON.parse(userWalletAddress);
              const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
              if (parsedCache.address && Date.now() - parsedCache.timestamp < CACHE_TTL_MS) {
                userWalletAddress = parsedCache.address;
              } else {
                userWalletAddress = null; // Expired, will re-fetch next time or if we structured the loop differently. Actually, let's just re-fetch right away.
                const rootContract = new ever.Contract(TokenRootAbi, new Address((launch.onchainData?.tokenRootAddress || ""))) as unknown as TypedContract<TokenRootMethods>;
                const walletResult = await rootContract.methods.getWalletAddress({
                  ownerAddress: new Address(address)
                }).call();
                userWalletAddress = walletResult.walletAddress.toString();
                if (userWalletAddress && userWalletAddress !== "0:0000000000000000000000000000000000000000000000000000000000000000") {
                   localStorage.setItem(cacheKey, JSON.stringify({ address: userWalletAddress, timestamp: Date.now() }));
                }
              }
            } catch (e) {
               // Old format (just the address string) or corrupted
               const rootContract = new ever.Contract(TokenRootAbi, new Address((launch.onchainData?.tokenRootAddress || ""))) as unknown as TypedContract<TokenRootMethods>;
               const walletResult = await rootContract.methods.getWalletAddress({
                 ownerAddress: new Address(address)
               }).call();
               userWalletAddress = walletResult.walletAddress.toString();
               if (userWalletAddress && userWalletAddress !== "0:0000000000000000000000000000000000000000000000000000000000000000") {
                  localStorage.setItem(cacheKey, JSON.stringify({ address: userWalletAddress, timestamp: Date.now() }));
               }
            }
          }

          if (!userWalletAddress || userWalletAddress === "0:0000000000000000000000000000000000000000000000000000000000000000") {
            return null;
          }

          const walletContract = new ever.Contract(TokenWalletAbi, new Address(userWalletAddress)) as unknown as TypedContract<TokenWalletMethods>;
          const balanceResult = await walletContract.methods.getDetails({}).call();
          const balanceNano = balanceResult.balance;
          
          if (BigInt(String(balanceNano || "0")) > 0n) {
            return {
              ...launch,
              balance: nanoToDecimal(balanceNano),
              walletAddress: userWalletAddress
            };
          }
          return null;
        }));
        
        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            foundHoldings.push(result.value);
          }
        }
      }
      
      setHoldings(foundHoldings);
    } catch (err) {
      console.error("Scan failed", err);
    } finally {
      setScanning(false);
    }
  }, [session, launches]);

  useEffect(() => {
    if (session && launches.length > 0) {
      scanBalances();
    }
  }, [session, launches, scanBalances]);

  if (loading) {
    return <div className="page-wrapper container" style={{ textAlign: 'center', padding: '100px' }}>{t("common_loading")}</div>;
  }

  if (!session) {
    return (
      <div className="page-wrapper container" style={{ textAlign: 'center', padding: '100px' }}>
        <h2 className={createStyles['form-title']}>{t("portfolio_title")}</h2>
        <p className={createStyles['form-subtitle']}>{t("portfolio_login")}</p>
        <Link href="/auth?from=/portfolio" className="btn-primary" style={{ display: 'inline-block', marginTop: '20px' }}>{t("nav_connect")}</Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{t("portfolio_title")} | AckiMeme</title>
      </Head>

      <main className="page-wrapper container" style={{ paddingTop: '40px' }}>
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className={createStyles['form-title']} style={{ margin: 0 }}>{t("portfolio_title")}</h1>
            <p className={createStyles['form-subtitle']} style={{ margin: 0 }}>Tracking your AckiMeme assets</p>
          </div>
          <button className="filter-btn" onClick={scanBalances} disabled={scanning}>
            {scanning ? "Scanning..." : "↻ Refresh Balances"}
          </button>
        </header>

        {/* DESIGN-6: Show message when wallet extension is not available */}
        {noProvider && (
          <div className="card" style={{ textAlign: 'center', padding: '40px', marginBottom: '24px', border: '1px dashed var(--ink-faint)' }}>
            <p style={{ fontSize: '36px', marginBottom: '12px' }}>🔌</p>
            <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }}>Wallet Extension Required</h3>
            <p className={createStyles['form-subtitle']}>Install the Acki Nacki Wallet browser extension to view your on-chain token balances.</p>
          </div>
        )}

        {/* Tab Toggle buttons */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--ink-faint)', paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab("holdings")}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === "holdings" ? '2px solid var(--accent)' : 'none',
              color: activeTab === "holdings" ? 'var(--ink)' : 'var(--ink-soft)',
              paddingBottom: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            💰 holdings
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === "watchlist" ? '2px solid var(--accent)' : 'none',
              color: activeTab === "watchlist" ? 'var(--ink)' : 'var(--ink-soft)',
              paddingBottom: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ★ watchlist
          </button>
          <button
            onClick={() => setActiveTab("ackipoints")}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === "ackipoints" ? '2px solid var(--accent)' : 'none',
              color: activeTab === "ackipoints" ? 'var(--ink)' : 'var(--ink-soft)',
              paddingBottom: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🏆 Acki Points
          </button>
        </div>

        {activeTab === "holdings" ? (
          <>
            <div className="portfolio-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              <div className="card" style={{ border: '1px solid var(--accent-glow)', background: 'rgba(0, 255, 136, 0.05)' }}>
                <p className={styles['stat-label']}>Unique Assets</p>
                <p className={styles['stat-value']} style={{ fontSize: '32px' }}>{holdings.length}</p>
              </div>
              <div className="card">
                <p className={styles['stat-label']}>Wallet Address</p>
                <p className={styles['stat-value']} style={{ fontSize: '14px', color: 'var(--ink-soft)' }}>{compactWallet(session.walletAddress)}</p>
              </div>
            </div>

            {holdings.length === 0 && !noProvider ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: '48px', marginBottom: '20px' }}>📉</p>
                <h3 style={{ color: 'var(--ink)', marginBottom: '10px' }}>{t("portfolio_empty")}</h3>
                <p className={createStyles['form-subtitle']}>Head over to the board to start trading!</p>
                <Link href="/" className="btn-primary" style={{ display: 'inline-block', marginTop: '24px' }}>{t("nav_board")}</Link>
              </div>
            ) : holdings.length > 0 ? (
              <div className="portfolio-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {holdings.map((token) => (
                  <Link href={`/token/${token.id}`} key={token.id} className={`card ${styles['portfolio-item-card']}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', transition: 'transform 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="token-avatar" style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-deep)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>
                        {isSafeUrl(token.coin.logoUrl) ? <Image src={token.coin.logoUrl} alt="" width={48} height={48} style={{ borderRadius: '12px', objectFit: 'cover' }} unoptimized /> : token.coin.symbol[0]}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>{token.coin.name}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent)', fontWeight: 700 }}>${token.coin.symbol}</p>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p className={styles['stat-label']}>Balance</p>
                      <p className={styles['stat-value']} style={{ margin: 0, color: 'var(--ink)' }}>{formatNum(token.balance)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        ) : activeTab === "watchlist" ? (
          <>
            {favorites.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: '48px', marginBottom: '20px' }}>★</p>
                <h3 style={{ color: 'var(--ink)', marginBottom: '10px' }}>Your Watchlist is Empty</h3>
                <p className={createStyles['form-subtitle']}>Add tokens to your watchlist to track them here!</p>
                <Link href="/" className="btn-primary" style={{ display: 'inline-block', marginTop: '24px' }}>Explore Tokens</Link>
              </div>
            ) : (
              <div className="portfolio-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {favorites.map((token) => (
                  <Link href={`/token/${token.id}`} key={token.id} className={`card ${styles['portfolio-item-card']}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', transition: 'transform 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="token-avatar" style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-deep)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>
                        {isSafeUrl(token.coin.logoUrl) ? <Image src={token.coin.logoUrl} alt="" width={48} height={48} style={{ borderRadius: '12px', objectFit: 'cover' }} unoptimized /> : token.coin.symbol[0]}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>{token.coin.name}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent)', fontWeight: 700 }}>${token.coin.symbol}</p>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="status-badge" style={{ fontSize: '10px' }}>{token.status.replace(/_/g, " ")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "ackipoints" ? (
          <>
            <div className="card" style={{ border: '1px solid #fbbf24', background: 'rgba(251, 191, 36, 0.05)', textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '48px', margin: 0 }}>🏆</p>
              <h2 style={{ color: '#fbbf24', marginTop: '16px', marginBottom: '8px' }}>15,400 Acki Points</h2>
              <p className={createStyles['form-subtitle']}>Invite friends and earn points! Use points to launch coins or register .acki domains for free.</p>
              
              <div style={{ marginTop: '24px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
                <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '8px' }}>Your Referral Link</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ background: '#000', padding: '8px 12px', borderRadius: '8px', color: 'var(--ink)' }}>
                    https://ackimeme.com/?ref={session.walletAddress.slice(0, 10)}...
                  </code>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }}>Copy</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px' }}>
                <button style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  🎟️ Redeem Free Token Launch
                </button>
                <button style={{ background: 'transparent', border: '1px solid #fbbf24', color: '#fbbf24', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  🎟️ Redeem Free .acki Domain
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ marginBottom: '16px' }}>Your Creator NFTs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {launches.filter(l => l.creatorWallet === session.walletAddress).length === 0 ? (
                  <p className={createStyles['form-subtitle']}>You haven't launched any tokens yet. Launch a token to earn a Genesis Badge!</p>
                ) : (
                  launches.filter(l => l.creatorWallet === session.walletAddress).map((launch) => {
                    const rBalance = Number(launch.onchainData?.reserveBalance || 0);
                    let badgeLevel = "Bronze";
                    let badgeColor = "linear-gradient(135deg, #cd7f32, #8b5a2b)";
                    let badgeText = "🥉 Bronze Badge (New Token)";
                    let textColor = "#cd7f32";

                    if (rBalance >= 6900000000000000) {
                      badgeLevel = "Gold";
                      badgeColor = "linear-gradient(135deg, #fbbf24, #f59e0b)";
                      badgeText = "🥇 Gold Badge (Token migrated to AckiSwap!)";
                      textColor = "#fbbf24";
                      
                      // Mocking Diamond for tokens that have been live for a while (e.g. pumped forever or very high volume)
                      if (launch.protocol?.pumpForever) {
                        badgeLevel = "Diamond";
                        badgeColor = "linear-gradient(135deg, #38bdf8, #818cf8, #c084fc)";
                        badgeText = "💎 Diamond Badge ($1M+ Volume Hero)";
                        textColor = "#38bdf8";
                      }
                    }

                    return (
                      <div key={`nft-${launch.id}`} className="card" style={{ border: `1px solid ${textColor}40`, display: 'flex', alignItems: 'center', gap: '16px', background: `rgba(0,0,0,0.2)` }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 15px ${textColor}40` }}>
                          {isSafeUrl(launch.coin.logoUrl) ? (
                            <Image src={launch.coin.logoUrl || ""} alt="" width={48} height={48} style={{ borderRadius: '8px' }} unoptimized />
                          ) : (
                            <span style={{ fontSize: '24px' }}>{launch.coin.symbol[0]}</span>
                          )}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--ink)' }}>Genesis Creator: {launch.coin.symbol}</h4>
                          <p style={{ margin: 0, fontSize: '12px', color: textColor, fontWeight: 700, marginTop: '4px' }}>{badgeText}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
