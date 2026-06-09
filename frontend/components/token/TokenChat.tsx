import React, { useState } from "react";
import { useRouter } from "next/router";
import { compactWallet, formatDate, hashColor } from "../../lib/utils";
import { postComment } from "../../lib/api";
import { useToast } from "../../lib/useToast";
import { useI18n } from "../../lib/i18n";
import type { CommentType, Session } from "../../types";
import styles from "../../styles/Token.module.css";

interface TokenChatProps {
  launchId: string;
  comments: CommentType[];
  session: Session | null;
  onCommentPosted: (comment: CommentType) => void;
}

/** Sanitize user-generated text to prevent XSS injection */
function sanitizeText(text: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function TokenChat({ launchId, comments, session, onCommentPosted }: TokenChatProps): React.JSX.Element {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return router.push(`/auth?from=/token/${launchId}`);
    if (!newComment.trim() || isPosting) return;

    setIsPosting(true);
    try {
      const res = await postComment(launchId, newComment);
      onCommentPosted((res as any).comment);
      setNewComment("");
      toast.success("Success", "Comentário postado com sucesso!");
    } catch (err: any) {
      toast.error("Erro", err.message || "Falha ao postar comentário.");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <div className={`card`} style={{ marginTop: '24px' }}>
      <p className={styles.infoLabel} style={{ marginBottom: '16px' }}>{t("chat_title")}</p>
      
      {/* Chat Feed */}
      <div className={`chat-feed`} style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {comments.length === 0 ? (
          <p className={styles.tokenTime} style={{ textAlign: 'center', padding: '20px' }}>{t("chat_empty")}</p>
        ) : (
          comments.map(c => {
            const isWhale = c.walletAddress.endsWith("f") || c.walletAddress.endsWith("0"); // Gamified Mock logic for VIP
            const isSystem = c.walletAddress === "SYSTEM";

            if (isSystem) {
              return (
                <div key={c.id} style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.1), transparent)', padding: '12px', borderRadius: '8px', borderLeft: `2px solid #10b981` }}>
                   <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700 }}>🚨 SYSTEM WHALE ALERT:</span>
                   <span style={{ fontSize: '13px', color: '#fff', marginLeft: '8px' }}>{sanitizeText(c.content)}</span>
                </div>
              );
            }

            return (
              <div key={c.id} style={{ 
                background: isWhale ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(245, 158, 11, 0.05))' : 'var(--bg-deep)', 
                padding: '12px', 
                borderRadius: '8px', 
                borderLeft: `2px solid ${isWhale ? '#fbbf24' : hashColor(c.walletAddress)}`,
                boxShadow: isWhale ? '0 0 10px rgba(251, 191, 36, 0.1)' : 'none'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: isWhale ? '#fbbf24' : hashColor(c.walletAddress), fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isWhale && <span title="Top Holder">🐳</span>}
                    {compactWallet(c.walletAddress)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--ink-soft)' }}>
                    {formatDate(c.createdAt)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: isWhale ? '#fef3c7' : 'var(--ink)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {sanitizeText(c.content)}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Comment Input */}
      <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className={`text-input`}
          style={{ flex: 1 }}
          placeholder={session ? t("chat_placeholder") : t("chat_signin")}
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          disabled={!session || isPosting}
          maxLength={500}
        />
        <button 
          type="submit" 
          className={`btn-primary`} 
          disabled={!session || !newComment.trim() || isPosting}
          style={{ padding: '0 20px', fontSize: '13px' }}
        >
          {isPosting ? "..." : t("chat_send")}
        </button>
      </form>
    </div>
  );
}
