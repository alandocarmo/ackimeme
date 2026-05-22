import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { getSession, getPublicLaunches } from "../lib/api";
import { TokenRootAbi, TokenWalletAbi } from "../lib/abi";
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

  const [activeTab, setActiveTab] = useState<string>("holdings"); // holdings | watchlist
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
            const rootContract = new ever.Contract(TokenRootAbi, new Address((launch.onchainData?.tokenRootAddress || "")));
            const walletResult = await (rootContract.methods as any).walletOf({
              answerId: 0,
              walletOwner: address
            }).call();
            userWalletAddress = walletResult.value0.toString();
            
            if (userWalletAddress && userWalletAddress !== "0:0000000000000000000000000000000000000000000000000000000000000000") {
               localStorage.setItem(cacheKey, userWalletAddress);
            }
          }

          if (!userWalletAddress || userWalletAddress === "0:0000000000000000000000000000000000000000000000000000000000000000") {
            return null;
          }

          const walletContract = new ever.Contract(TokenWalletAbi, new Address(userWalletAddress));
          const balanceResult = await (walletContract.methods as any).balance({ answerId: 0 }).call();
          const balanceNano = balanceResult.value0;
          
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
                        {isSafeUrl(token.coin.logoUrl) ? <img src={token.coin.logoUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '12px' }} /> : token.coin.symbol[0]}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>{token.coin.name}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent)', fontWeight: 700 }}>${token.coin.symbol}</p>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p className={styles['stat-label']}>Balance</p>
                      <p className={styles['stat-value']} style={{ margin: 0, color: 'var(--ink)' }}>{formatNum(token.balance.toFixed(2))}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        ) : (
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
                        {isSafeUrl(token.coin.logoUrl) ? <img src={token.coin.logoUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '12px' }} /> : token.coin.symbol[0]}
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
        )}
      </main>

      <style jsx>{``}</style>
    </>
  );
}
