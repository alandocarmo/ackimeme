import React, { useState } from "react";
import Link from "next/link";
import { useI18n } from "../../lib/i18n";
import type { Launch, Session } from "../../types";

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
  onTrade: (amountOverride?: string, modeOverride?: "buy" | "sell") => void;
  tradeSuccess: string;
  userShellEccBalance: number | null;
  userTokenBalance: number | null;
  onchainPrice: number | null;
  estimate: { value: string; fee: string | null; impact: number | null };
  tradeFeeBps: number;
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
  tradeFeeBps,
}: TokenTradingPanelProps): React.JSX.Element {
  const { t } = useI18n();
  const [payCurrency, setPayCurrency] = useState("SHELL");
  const [degenMode, setDegenMode] = useState(false);

  // Premium UI Inline Styles
  const panelStyle: React.CSSProperties = {
    background: "rgba(20, 20, 25, 0.8)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "24px",
    padding: "24px",
    color: "#fff",
    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
    fontFamily: "'Inter', sans-serif",
  };

  const tabContainer: React.CSSProperties = {
    display: "flex",
    background: "rgba(0,0,0,0.4)",
    borderRadius: "12px",
    padding: "4px",
    marginBottom: "24px",
  };

  const getTabStyle = (isActive: boolean, type: string): React.CSSProperties => ({
    flex: 1,
    padding: "12px",
    textAlign: "center",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.3s ease",
    background: isActive 
      ? (type === "buy" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)")
      : "transparent",
    color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
  });

  const inputContainer: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "12px 16px",
    marginBottom: "12px",
    transition: "border-color 0.3s ease",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: "24px",
    fontWeight: 700,
    outline: "none",
    width: "100%",
  };

  const currencySelect: React.CSSProperties = {
    background: "rgba(255,255,255,0.1)",
    border: "none",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
  };

  const isMigrated = token.onchainData?.reserveBalance && Number(token.onchainData.reserveBalance) >= 6900000000000000;

  return (
    <aside style={{ width: "100%", maxWidth: "400px" }}>
      <div style={panelStyle}>
        
        {isMigrated && (
          <div style={{ background: "linear-gradient(90deg, #8b5cf6, #3b82f6)", padding: "12px", borderRadius: "12px", textAlign: "center", marginBottom: "20px", fontWeight: "bold" }}>
            ✨ AckiSwap Premium Pool Active
          </div>
        )}

        {!degenMode && (
          <div style={tabContainer}>
            <div style={getTabStyle(tradeMode === "buy", "buy")} onClick={() => setTradeMode("buy")}>
              {t("detail_buy")}
            </div>
            <div style={getTabStyle(tradeMode === "sell", "sell")} onClick={() => setTradeMode("sell")}>
              {t("detail_sell")}
            </div>
          </div>
        )}

        {/* Degen Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: degenMode ? '#f59e0b' : 'rgba(255,255,255,0.6)', fontWeight: degenMode ? 'bold' : 'normal', transition: 'all 0.3s' }}>
            ⚡ Degen Mode
          </span>
          <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
            <input type="checkbox" checked={degenMode} onChange={(e) => setDegenMode(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: degenMode ? '#f59e0b' : 'rgba(255,255,255,0.1)', borderRadius: '20px', transition: '0.4s'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '16px', width: '16px', left: degenMode ? '22px' : '2px', bottom: '2px',
                backgroundColor: '#fff', borderRadius: '50%', transition: '0.4s'
              }} />
            </span>
          </label>
        </div>

        {degenMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              1 Click Buy (Slippage: {slippage}%) • $1 USD = 100 SHELL
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: "$10", shell: 1000 },
                { label: "$50", shell: 5000 },
                { label: "$100", shell: 10000 }
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={() => {
                    setTradeMode("buy");
                    setPayCurrency("SHELL");
                    setTradeAmount(btn.shell.toString());
                    // Fire immediately with modeOverride
                    onTrade(btn.shell.toString(), "buy");
                  }}
                  disabled={isTrading || token.onchainData?.deployStatus !== 'deployed'}
                  style={{
                    flex: 1, padding: '16px 0', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none', borderRadius: '12px', color: '#fff', fontSize: '18px', fontWeight: 800,
                    cursor: (isTrading || token.onchainData?.deployStatus !== 'deployed') ? 'not-allowed' : 'pointer',
                    opacity: (isTrading || token.onchainData?.deployStatus !== 'deployed') ? 0.5 : 1,
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)', transition: 'transform 0.1s'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={inputContainer}>
            <input 
              type="number" 
              style={inputStyle}
              placeholder="0.00" 
              value={tradeAmount} 
              onChange={(e) => setTradeAmount(e.target.value)}
              min="0"
              step="any"
            />
            {tradeMode === "buy" ? (
              <select 
                style={currencySelect} 
                value={payCurrency} 
                onChange={(e) => setPayCurrency(e.target.value)}
              >
                <option value="SHELL">SHELL</option>
              </select>
            ) : (
              <span style={{ fontSize: "18px", fontWeight: 700 }}>{token.coin.symbol}</span>
            )}
          </div>

          {payCurrency !== "SHELL" && tradeMode === "buy" && (
            <div style={{ fontSize: "11px", color: "#fbbf24", marginBottom: "12px", textAlign: "right" }}>
              ⚡ Auto-swapping via DEX.DO before buy
            </div>
          )}

          {/* Quick Percentages */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[0.25, 0.50, 0.75, 1.0].map((pct) => (
              <button 
                key={pct}
                style={{
                  flex: 1, padding: '8px 0', background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  color: '#fff', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s'
                }}
                onClick={() => {
                  if (tradeMode === "buy" && payCurrency === "SHELL") {
                    if (userShellEccBalance !== null) {
                      const amount = userShellEccBalance * pct;
                      const maxSafe = Math.max(0, amount - (pct === 1.0 ? 0.2 : 0));
                      setTradeAmount(maxSafe > 0 ? maxSafe.toFixed(2) : "");
                    }
                  } else if (tradeMode === "sell") {
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: '12px', color: "rgba(255,255,255,0.6)" }}>{t("detail_slippage")}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {["1", "2", "5"].map(p => (
                <button 
                  key={p} 
                  style={{
                    background: slippage === p ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)",
                    border: "none", borderRadius: "6px", color: "#fff", padding: "4px 12px", fontSize: "12px", cursor: "pointer"
                  }} 
                  onClick={() => setSlippage(p)}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>{t("detail_estimated_return")}</span>
              <span style={{ fontWeight: 600, fontSize: "14px" }}>
                {estimate.value} {tradeMode === "buy" ? token.coin.symbol : "SHELL"}
              </span>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: estimate.impact !== null ? "8px" : "0" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>Protocol Fee ({(tradeFeeBps / 100).toFixed(1)}%)</span>
              <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 600 }}>
                {estimate.fee ? `${estimate.fee} SHELL` : `${(tradeFeeBps / 100).toFixed(1)}%`}
              </span>
            </div>
            
            {estimate.impact !== null && estimate.impact > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>{t("detail_price_impact") || "Price Impact"}</span>
                <span style={{ color: estimate.impact > 5 ? "#ef4444" : "#f59e0b", fontSize: "12px", fontWeight: 600 }}>
                  {estimate.impact.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <button 
            style={{
              width: "100%", padding: "16px", borderRadius: "16px", border: "none",
              background: token.onchainData?.deployStatus !== 'deployed' || isTrading
                ? "rgba(255,255,255,0.1)"
                : (tradeMode === "buy" ? "#10b981" : "#ef4444"),
              color: "#fff", fontSize: "16px", fontWeight: 700, cursor: "pointer",
              transition: "transform 0.1s",
              boxShadow: "0 4px 14px 0 rgba(0, 0, 0, 0.25)"
            }}
            onClick={() => onTrade()}
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
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', fontWeight: 600, color: "#10b981" }}>
              ✅ {tradeSuccess}
            </p>
          )}
          </div>
        )}

      </div>

      {!session && (
        <div style={{ marginTop: '16px', textAlign: 'center', padding: '16px', background: "rgba(20, 20, 25, 0.8)", borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <p style={{ marginBottom: '12px', color: "#fff" }}>{t("detail_connect_wallet")}</p>
          <Link href={`/auth?from=/token/${token.id}`} style={{ display: 'block', background: "#3b82f6", color: "#fff", padding: "12px", borderRadius: "12px", textDecoration: "none", fontWeight: 600 }}>
            {t("nav_connect")}
          </Link>
        </div>
      )}
    </aside>
  );
}
