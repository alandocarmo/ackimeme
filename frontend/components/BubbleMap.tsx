import React, { useMemo } from "react";
import type { Holder } from "../types";
import { compactWallet, hashColor } from "../lib/utils";

// BubbleMap: SVG-based Sunflower Spiral packing for top holders
export function BubbleMap({ holders, totalSupply }: { holders: Holder[], totalSupply: number }): React.JSX.Element | null {
  const placedNodes = useMemo(() => {
    if (!holders || holders.length === 0) return [];

    const SVG_SIZE = 320;
    const CENTER = SVG_SIZE / 2;
    const placed = [];

    const sortedNodes = [...holders].map((h, i) => {
      const pct = totalSupply > 0 ? (h.balance / totalSupply) * 100 : 0;
      const r = Math.max(8, Math.sqrt(pct) * 12);
      return { ...h, pct, r, id: i };
    }).sort((a, b) => b.balance - a.balance).slice(0, 50);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      let angle = 0;
      let dist = 0;
      let cx = CENTER, cy = CENTER;
      let overlapping = true;
      let attempts = 0;

      while (overlapping && attempts < 400) {
        cx = CENTER + Math.cos(angle) * dist;
        cy = CENTER + Math.sin(angle) * dist;

        overlapping = placed.some(p => {
          const dx = (p as any).cx - cx;
          const dy = (p as any).cy - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          return d < ((p as any).r + node.r + 3);
        });

        if (overlapping) {
          dist += 1.5;
          angle += 2.39996;
          attempts++;
        }
      }
      (node as any).cx = cx;
      (node as any).cy = cy;
      placed.push(node);
    }
    return placed;
  }, [holders, totalSupply]);

  if (placedNodes.length === 0) return null;
  const SVG_SIZE = 320;

  return (
    <div style={{ background: 'var(--bg-deep)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'center', overflow: 'hidden', position: 'relative', width: '100%' }}>
      <svg width="100%" height="100%" style={{ maxWidth: '320px', aspectRatio: '1/1' }} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        {placedNodes.map(n => (
          <g key={n.id} transform={`translate(${(n as any).cx}, ${(n as any).cy})`} style={{ transition: 'transform 0.3s ease' }}>
            <circle 
              r={n.r} 
              fill={n.isBondingCurve ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
              stroke={n.isBondingCurve ? '#3b82f6' : hashColor(n.walletAddress)}
              strokeWidth="2"
            />
             {n.r > 15 && (
               <text textAnchor="middle" dy=".3em" fill="#fff" fontSize={n.r > 25 ? "10px" : "8px"} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                 {n.pct.toFixed(1)}%
               </text>
            )}
            <title>{n.isBondingCurve ? "Bonding Curve" : compactWallet(n.walletAddress)}: {n.pct.toFixed(2)}%</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
