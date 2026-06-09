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
  const [payCurrency, setPayCurrency] = useState("SHELL");

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

  const isMigrated = token.onchainData?.reserveBalance && token.onchainData.reserveBalance >= 6900000;

  return (
    <aside style={{ width: "100%", maxWidth: "400px" }}>
      <div style={panelStyle}>
        
        {isMigrated && (
          <div style={{ background: "linear-gradient(90deg, #8b5cf6, #3b82f6)", padding: "12px", borderRadius: "12px", textAlign: "center", marginBottom: "20px", fontWeight: "bold" }}>
            ✨ AckiSwap Premium Pool Active
          </div>
        )}

        <div style={tabContainer}>
          <div style={getTabStyle(tradeMode === "buy", "buy")} onClick={() => setTradeMode("buy")}>
            {t("detail_buy")}
          </div>
          <div style={getTabStyle(tradeMode === "sell", "sell")} onClick={() => setTradeMode("sell")}>
            {t("detail_sell")}
          </div>
        </div>

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
                <option value="USDC">USDC (Zap)</option>
                <option value="NACKL">NACKL (Zap)</option>
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
            
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>Protocol Fee (0.3%)</span>
              <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 600 }}>0.25% Pool | 0.05% DEX</span>
            </div>
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
            onClick={onTrade}
            disabled={isTrading || token.onchainData?.deployStatus !== 'deployed'}
          >
            {isTrading 
              ? t("detail_processing") 
              : token.onchainData?.deployStatus !== 'deployed'
                ? t("info_pending")
                : (tradeMode === "buy" ? `Zap In ${payCurrency}` : t("detail_execute_sell"))
            }
          </button>
          
          {tradeSuccess && (
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', fontWeight: 600, color: "#10b981" }}>
              ✅ {tradeSuccess}
            </p>
          )}

        </div>
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
