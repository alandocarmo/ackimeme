import React from "react";
import styles from "../styles/Token.module.css";

export function CandlestickChart({ history }: { history: { time: number, open: number, close: number, high: number, low: number }[] }): React.JSX.Element {
  if (!history || history.length === 0) {
    return (
      <div className={`card ${styles.chartCard}`} style={{ height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--ink-soft)', border: '1px solid var(--ink-faint)', background: '#0a0a0a' }}>
        No price history available yet. Start trading to generate candles!
      </div>
    );
  }

  let minPrice = Math.min(...history.map(c => c.low));
  let maxPrice = Math.max(...history.map(c => c.high));
  
  const priceDiff = maxPrice - minPrice;
  const padding = priceDiff === 0 ? minPrice * 0.1 : priceDiff * 0.1;
  minPrice = Math.max(0, minPrice - padding);
  maxPrice = maxPrice + padding;

  const width = 1000;
  const height = 240;
  const paddingLeft = 10;
  const paddingRight = 80;
  const paddingTop = 20;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const scaleY = (val: number) => {
    if (maxPrice - minPrice === 0) return paddingTop + chartHeight / 2;
    return paddingTop + chartHeight - ((val - minPrice) / (maxPrice - minPrice)) * chartHeight;
  };

  const candleWidth = Math.max(2, (chartWidth / history.length) * 0.7);
  const gap = (chartWidth / history.length) * 0.3;

  return (
    <div className={`card ${styles.chartCard}`} style={{ height: '240px', padding: '10px', border: '1px solid var(--ink-faint)', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
          const price = minPrice + (maxPrice - minPrice) * p;
          const y = scaleY(price);
          return (
            <g key={idx}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={width - paddingRight + 5} y={y + 4} fill="var(--ink-soft)" fontSize="10" fontFamily="monospace">
                {price.toFixed(9)}
              </text>
            </g>
          );
        })}

        {/* Candles */}
        {history.map((candle, idx) => {
          const x = paddingLeft + idx * (chartWidth / history.length) + gap / 2;
          const openY = scaleY(candle.open);
          const closeY = scaleY(candle.close);
          const highY = scaleY(candle.high);
          const lowY = scaleY(candle.low);

          const isUp = candle.close >= candle.open;
          const color = isUp ? '#10b981' : '#ef4444';

          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(2, Math.abs(closeY - openY));

          return (
            <g key={idx}>
              <line x1={x + candleWidth / 2} y1={highY} x2={x + candleWidth / 2} y2={lowY} stroke={color} strokeWidth="1.5" />
              <rect x={x} y={bodyY} width={candleWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth="1" rx="1" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
