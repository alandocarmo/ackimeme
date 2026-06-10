import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { getSession } from "../../lib/api";
import { useToast } from "../../lib/useToast";
import { formatNum, getSlopeLabel, formatSupply, compactWallet, isSafeUrl, formatDate, toNano, nanoToDecimal, hashColor, calcBondingStats, MIGRATION_THRESHOLD_NANO } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import styles from "../../styles/Token.module.css";
import type { Session, Launch } from "../../types";

import { PriceChart } from "../../components/PriceChart";
import { BubbleMap } from "../../components/BubbleMap";
import { TradingChart } from "../../components/TradingChart";
import { TokenHeader } from "../../components/token/TokenHeader";
import { TokenChat } from "../../components/token/TokenChat";
import { TokenTradingPanel } from "../../components/token/TokenTradingPanel";
import { SEO } from "../../components/SEO";
import { Skeleton } from "../../components/ui/Skeleton";

import { useTokenData } from "../../hooks/useTokenData";
import { useOnchainPrice } from "../../hooks/useOnchainPrice";
import { useTrading } from "../../hooks/useTrading";
import { useBalances } from "../../hooks/useBalances";
import { useFavorite } from "../../hooks/useFavorite";

export default function TokenPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = router.query;
  const idStr = Array.isArray(id) ? id[0] : id as string;

  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then((r) => setSession(r.session)).catch(() => {});
  }, []);

  const { toast, ToastContainer } = useToast();

  const { token, loading, error, comments, trades, holders, totalSupply, priceHistory, handleCommentPosted } = useTokenData(idStr);
  const { isFavorite, handleToggleFavorite } = useFavorite(session, idStr);
  const { onchainPrice } = useOnchainPrice(token);
  
  const {
    tradeMode, setTradeMode,
    tradeAmount, setTradeAmount,
    slippage, setSlippage,
    isTrading, tradeSuccess, error: tradeError,
    buyReturn, sellReturn,
    handleTrade, TRADE_FEE_BPS
  } = useTrading(session, token, onchainPrice, t);

  const { userShellEccBalance, userTokenBalance } = useBalances(session, token, tradeSuccess);

  const [chartTab, setChartTab] = useState<"theory" | "live">("theory");
  const [selectedInterval, setSelectedInterval] = useState<number>(15);

  const memoizedEstimate = useMemo(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      return { value: "0.00", fee: null, impact: null };
    }
    
    if (tradeMode === "buy") {
      const tokensOut = buyReturn !== null ? buyReturn : 0;
      let impact = null;
      if (onchainPrice && onchainPrice > 0) {
         const expectedTokensWithoutImpact = parseFloat(tradeAmount) / onchainPrice;
         if (expectedTokensWithoutImpact > 0) {
           impact = Math.max(0, ((expectedTokensWithoutImpact - tokensOut) / expectedTokensWithoutImpact) * 100);
         }
      }
      return { 
        value: tokensOut > 0 ? tokensOut.toFixed(2) : "aguardando...", 
        fee: (parseFloat(tradeAmount) * (TRADE_FEE_BPS / 10000)).toFixed(4),
        impact 
      };
    } else {
      const shellOut = sellReturn !== null ? sellReturn : 0;
      let impact = null;
      if (onchainPrice && onchainPrice > 0) {
         const expectedShellWithoutImpact = parseFloat(tradeAmount) * onchainPrice;
         if (expectedShellWithoutImpact > 0) {
           impact = Math.max(0, ((expectedShellWithoutImpact - shellOut) / expectedShellWithoutImpact) * 100);
         }
      }
      return { 
        value: shellOut > 0 ? shellOut.toFixed(4) : "aguardando...", 
        fee: (shellOut * (TRADE_FEE_BPS / 10000)).toFixed(4),
        impact 
      };
    }
  }, [tradeAmount, tradeMode, onchainPrice, buyReturn, sellReturn, TRADE_FEE_BPS]);

  const stats = token && token.onchainData ? calcBondingStats(token.onchainData) : { progressPct: "0", hasOnchainReserve: false, reserveShell: 0, reserveRatio: 0, totalValueLocked: 0, tokenSupplyRaw: "0" };
  const color = hashColor(token?.coin?.symbol || "");
  const showMissingTokenCta = Boolean(error) && !loading && !token;

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
            <p className="text-danger mb-4">{error}</p>
            <Link href="/" className={`btn-primary`} style={{ padding: '10px 20px', fontSize: '13px' }}>Voltar para o feed</Link>
          </div>
        ) : error ? (
          <p className="text-danger" style={{ textAlign: 'center', padding: '40px' }}>{error}</p>
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
                      📈 {t("nav_board") || "Price Candles"}
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
                  <TradingChart history={priceHistory as any[]} />
                )}
              </div>

              {/* Bonding Curve Card */}
              {!token.protocol?.pumpForever ? (
                <div className={`card accent-card`}>
                  <div className={styles.progressHeader} style={{ marginBottom: '12px' }}>
                    <span className="font-bold text-success">⬡ Bonding Curve Progress</span>
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
                      <span className={styles.statValue} style={{ fontSize: '18px' }}>{(MIGRATION_THRESHOLD_NANO / 1e9 / 1e6).toFixed(1)}M {t("common_shell")}</span>
                    </div>
                  </div>
                  
                  <p className={styles.tokenSubtitle} style={{ fontSize: '11px', margin: 0, opacity: 0.8 }}>
                    {stats!.hasOnchainReserve
                      ? `Liquidity migrates to internal AMM at ${(MIGRATION_THRESHOLD_NANO / 1e9 / 1e6).toFixed(1)}M SHELL reserve.`
                      : "Progress requires reserveBalance indexed from blockchain. Values stay as awaiting until first trade."}
                  </p>
                </div>
              ) : (
                <div className={`card danger-card`}>
                  <div className={styles.progressHeader} style={{ marginBottom: '12px' }}>
                    <span className="text-danger font-bold">🚀 {t("card_pump_forever")}</span>
                    <span className={styles.tokenTime} style={{ color: 'var(--status-error)' }}>High Risk</span>
                  </div>
                  <p className={styles.tokenSubtitle} style={{ fontSize: '13px', margin: 0, color: 'var(--ink)' }}>
                    This token does <strong>not</strong> graduate to an AMM. Its price will continue to be discovered linearly via the bonding curve forever.
                  </p>
                  <div className={styles.tokenStats} style={{ borderTop: 'none', paddingTop: 0, marginTop: '20px', marginBottom: 0 }}>
                    <div className={styles.statBox} style={{ width: '100%', textAlign: 'center' }}>
                      <span className={styles.statLabel}>{t("card_reserve")}</span>
                      <span className={`text-danger ${styles.statValue}`} style={{ fontSize: '24px' }}>{stats!.hasOnchainReserve ? `${(stats!.reserveShell as number).toFixed(2)} SHELL` : "0.00 SHELL"}</span>
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
              setTradeMode={setTradeMode as any}
              tradeAmount={tradeAmount}
              setTradeAmount={setTradeAmount}
              slippage={slippage}
              setSlippage={setSlippage}
              isTrading={isTrading}
              onTrade={handleTrade as any}
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
