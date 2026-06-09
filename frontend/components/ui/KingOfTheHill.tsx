import React from "react";
import Link from "next/link";
import { useI18n } from "../../lib/i18n";
import type { Launch } from "../../types";

interface KingOfTheHillProps {
  kingToken: Launch | null;
}

export function KingOfTheHill({ kingToken }: KingOfTheHillProps) {
  const { t } = useI18n();

  if (!kingToken) return null;

  const progress = kingToken.onchainData?.reserveBalance 
    ? Math.min(100, (kingToken.onchainData.reserveBalance / 6900000) * 100) 
    : 0;

  return (
    <div style={{
      width: "100%",
      background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%)",
      border: "1px solid rgba(249, 115, 22, 0.3)",
      borderRadius: "24px",
      padding: "24px",
      marginBottom: "32px",
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 0 40px rgba(249, 115, 22, 0.2)"
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, fontSize: "100px", opacity: 0.1, pointerEvents: "none" }}>👑</div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ color: "#fbbf24", fontSize: "14px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            👑 King of the Hill
          </div>
          <h2 style={{ fontSize: "28px", margin: 0, display: "flex", alignItems: "center", gap: "12px" }}>
            {kingToken.metadata.image && (
              <img src={kingToken.metadata.image} alt={kingToken.coin.symbol} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
            )}
            {kingToken.coin.name} <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "18px" }}>${kingToken.coin.symbol}</span>
          </h2>
        </div>
        <Link href={`/token/${kingToken.id}`} style={{
          background: "linear-gradient(90deg, #f97316, #ef4444)",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: "12px",
          textDecoration: "none",
          fontWeight: 700,
          fontSize: "14px",
          boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)"
        }}>
          Buy Now
        </Link>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
          <span>Bonding Curve Progress</span>
          <span style={{ fontWeight: 800, color: "#fff" }}>{progress.toFixed(1)}%</span>
        </div>
        <div style={{ width: "100%", height: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "6px", overflow: "hidden" }}>
          <div style={{ 
            width: `${progress}%`, 
            height: "100%", 
            background: "linear-gradient(90deg, #f97316, #ef4444, #fbbf24)",
            boxShadow: "0 0 10px #fbbf24"
          }} />
        </div>
      </div>
    </div>
  );
}
