import React from "react";
import Image from "next/image";
import { isSafeUrl, hashColor } from "../../lib/utils";
import type { Launch } from "../../types";
import styles from "../../styles/Token.module.css";

interface TokenHeaderProps {
  token: Launch;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function TokenHeader({ token, isFavorite, onToggleFavorite }: TokenHeaderProps): React.JSX.Element {
  const color = hashColor(token.coin?.symbol);

  return (
    <div className={styles.tokenHeaderSection}>
      <div className={styles.tokenAvatar} style={{
        width: '80px',
        height: '80px',
        background: `linear-gradient(135deg, ${color}, ${color}44)`,
        fontSize: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px'
      }}>
        {isSafeUrl(token.coin?.logoUrl) ? (
          <Image src={token.coin.logoUrl || ""} alt="" width={80} height={80} style={{ objectFit: 'cover', borderRadius: '16px' }} unoptimized />
        ) : (
          <span style={{ color: '#fff', fontWeight: 700 }}>
            {(token.coin?.symbol || "?")[0]}
          </span>
        )}
      </div>
      <div className={styles.tokenTitleInfo}>
        <h1 className={styles.tokenMainTitle}>{token.coin.name}</h1>
        <span className={styles.tokenTicker}>${token.coin.symbol}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <div className={styles.statusBadge}>{token.status.replace(/_/g, " ")}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onToggleFavorite}
            style={{
              background: isFavorite ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: isFavorite ? '#eab308' : 'var(--ink-soft)',
              border: isFavorite ? '1px solid rgba(250, 204, 21, 0.3)' : '1px solid var(--ink-faint)',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '14px' }}>{isFavorite ? "★" : "☆"}</span>
            {isFavorite ? "Favorited" : "Favorite"}
          </button>

          <button 
            onClick={() => {
              const shareText = `Check out $${token.coin.symbol} on AckiMeme! 🚀`;
              const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
              window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
            }}
            style={{
              background: 'rgba(0, 136, 204, 0.1)',
              color: '#0088cc',
              border: '1px solid rgba(0, 136, 204, 0.2)',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
