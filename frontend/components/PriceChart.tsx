import React from "react";
import { useI18n } from "../lib/i18n";
import styles from "../styles/Token.module.css";

export function PriceChart({ currentPrice, progressPct, slopeDivisor }: { currentPrice: number | null, progressPct: string | null, slopeDivisor: number | null }): React.JSX.Element {
  const { t } = useI18n();
  const points = [];
  const pct = parseFloat(progressPct || "0");
  
  // M-10: Reflect actual slope in the theoretical chart curve
  const baseSlope = 10000000000000;
  const currentSlope = Number(slopeDivisor || baseSlope);
  const intensity = baseSlope / currentSlope; // Suave=0.5x, Normal=1x, Insane=10x
  const exponent = 1.4 + (intensity * 0.2); // Dynamic exponent for visual steepness

  for (let i = 0; i <= 40; i++) {
     const x = (i / 40) * 100;
     const y = 70 - (Math.pow(i / 40, exponent) * 50); 
     points.push(`${x},${y}`);
  }
  
  const currentX = pct;
  const currentY = 70 - (Math.pow(pct / 100, exponent) * 50);

  return (
    <div className={`card ${styles.chartCard}`} style={{ height: '240px', padding: '0', position: 'relative', overflow: 'hidden', border: '1px solid var(--ink-faint)', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,255,136,0.02) 100%)' }}>
       <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
          <p className={styles.infoLabel} style={{ margin: 0, fontSize: '10px' }}>{t("detail_bonding_curve")}</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            {currentPrice ? `${currentPrice.toFixed(9)}` : '---'} <span style={{ fontSize: '12px', fontWeight: 400 }}>{t("common_shell")}</span>
          </p>
       </div>
       
       <svg viewBox="0 0 100 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Grid lines */}
          <line x1="0" y1="20" x2="100" y2="20" stroke="var(--ink-faint)" strokeWidth="0.1" />
          <line x1="0" y1="45" x2="100" y2="45" stroke="var(--ink-faint)" strokeWidth="0.1" />
          
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.join(' ')}
            style={{ filter: 'url(#glow)' }}
          />
          <path
            d={`M 0 80 L ${points.join(' L ')} L 100 80 Z`}
            fill="url(#chartGradient)"
          />
          
          <circle 
            cx={currentX} 
            cy={currentY} 
            r="1.2" 
            fill="var(--bg)"
            stroke="var(--accent)"
            strokeWidth="0.5"
            style={{ filter: 'drop-shadow(0 0 5px var(--accent))' }}
          />
       </svg>
       
       <div style={{ position: 'absolute', bottom: '10px', right: '15px', color: 'var(--ink-soft)', fontSize: '10px' }}>
         {t("info_bonding_curve")}: {pct}%
       </div>
    </div>
  );
}
