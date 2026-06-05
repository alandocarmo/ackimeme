import React from "react";
import Link from "next/link";
import { useI18n } from "../../lib/i18n";
import type { Launch, Session } from "../../types";
import styles from "../../styles/Token.module.css";

interface TokenTradingPanelProps {
  token: Launch;
  session: Session | null;
  tradeMode: string;
  setTradeMode: (mode: string) => void;
  tradeAmount: string;
  setTradeAmount: (amount: string) => void;
  slippage: string;
  setSlippage: (s: string) => void;
  isTrading: boolean;
  onTrade: () => void;
  tradeSuccess: string;
  userShellEccBalance: number | null;
  userTokenBalance: number | null;
  onchainPrice: number | null;
  estimate: { value: string; fee: string | null; impact: number | null };
}

export function TokenTradingPanel({
  token,
  session,
  tradeMode,
  setTradeMode,
  tradeAmount,
  setTradeAmount,
  slippage,
  setSlippage,
  isTrading,
  onTrade,
  tradeSuccess,
  userShellEccBalance,
  userTokenBalance,
  onchainPrice,
  estimate,
}: TokenTradingPanelProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <aside className={styles.detailSidebar}>
      <div className={styles.tradeWidget}>
        <div className={styles.tradeTabs}>
          <button className={`trade-tab ${tradeMode === "buy" ? "active-buy" : ""}`} onClick={() => setTradeMode("buy")}>{t("detail_buy")}</button>
          <button className={`trade-tab ${tradeMode === "sell" ? "active-sell" : ""}`} onClick={() => setTradeMode("sell")}>{t("detail_sell")}</button>
        </div>

        <div className={styles.tradePanel}>
          <div className={styles.tradeFieldWrap}>
            <div className={styles.inputContainer}>
              <input 
                type="number" 
                className={styles.tradeInput}
                placeholder="0.00" 
                value={tradeAmount} 
                onChange={(e) => setTradeAmount(e.target.value)}
                min="0"
                step="any"
              />
              <span className={styles.inputUnit}>{tradeMode === "buy" ? "SHELL" : token.coin.symbol}</span>
            </div>

            {/* Quick Trade Percentages */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {[0.25, 0.50, 0.75, 1.0].map((pct) => (
                <button 
                  key={pct}
                  type="button"
                  className={styles.slipBtn}
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

          <div className={styles.slippageRow}>
            <span className={styles.infoLabel} style={{ fontSize: '9px' }}>{t("detail_slippage")}</span>
            <div className={styles.slippageBtns}>
              {["1", "2", "5"].map(p => (
                <button key={p} className={`slip-btn ${slippage === p ? "active" : ""}`} onClick={() => setSlippage(p)}>{p}%</button>
              ))}
            </div>
          </div>

          {/* Estimate Display */}
          <div className={styles.estimateBox}>
            <span className={styles.estimateLabel}>{t("detail_estimated_return")} ≈</span>
            <span className={styles.estimateVal}>
              {estimate.value} {tradeMode === "buy" ? token.coin.symbol : "SHELL"}
            </span>
          </div>

          {estimate.fee && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span className={styles.tokenTime} style={{ fontSize: '10px', color: 'var(--accent-warm)' }}>
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

          {onchainPrice && (
            <p className={styles.tokenTime} style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>
              Current price: {onchainPrice.toFixed(9)} SHELL per token
            </p>
          )}

          <button 
            className={`trade-button ${tradeMode === 'buy' ? 'btn-buy' : 'btn-sell'}`}
            onClick={onTrade}
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
            <p className={`hero-accent`} style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', fontWeight: 600 }}>
              {tradeSuccess}
            </p>
          )}
          
          {tradeMode === "sell" && (
            <p className={styles.tokenTime} style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px' }}>
              Sell burns your tokens via TokenWallet → BondingCurve refund.
            </p>
          )}

          <p className={styles.tokenTime} style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px' }}>
            Need SHELL? <Link href={`/buy-shell?from=/token/${token.id}`} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Buy with card or crypto →</Link>
          </p>
        </div>
      </div>

      {!session && (
        <div className={`card`} style={{ marginTop: '16px', textAlign: 'center', padding: '16px' }}>
          <p className={styles.tokenTime} style={{ marginBottom: '12px' }}>{t("detail_connect_wallet")}</p>
          <Link href={`/auth?from=/token/${token.id}`} className={`filter-btn`} style={{ display: 'block' }}>{t("nav_connect")}</Link>
        </div>
      )}
    </aside>
  );
}
