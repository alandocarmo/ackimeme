import React, { useEffect, useState } from "react";
import Head from "next/head";
import { getSecurityAnomalies, unlockAdmin, getSession } from "../../lib/api";
import { Session } from "../../types";
import authStyles from "../../styles/Auth.module.css";
import adminStyles from "../../styles/Admin.module.css";

export default function SecurityAdmin() {
  const [anomalies, setAnomalies] = useState<Record<string, unknown>[]>([]);
  const [password, setPassword] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [session, setSession] = useState<Session | null>(null);

  // Load user session on mount
  useEffect(() => {
    getSession().then(r => setSession(r.session)).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!session?.walletAddress) {
        setError("Você precisa estar logado com uma carteira para acessar o painel admin. Faça login primeiro.");
        return;
      }
      await unlockAdmin(password, session.walletAddress);
      setLoggedIn(true);
      fetchAnomalies();
    } catch(err) {
      setError((err as Error).message);
    }
  }

  const fetchAnomalies = async () => {
    try {
      const r = await getSecurityAnomalies();
      setAnomalies((r.anomalies as Record<string, unknown>[]) || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (!loggedIn) return undefined;
    fetchAnomalies();
    const interval = setInterval(() => {
      fetchAnomalies();
    }, 10000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <main className={authStyles['auth-layout']} style={{ background: 'var(--bg-deep)' }}>
        <div className={authStyles['auth-card']} style={{ border: '1px solid var(--accent-warm)' }}>
          <h2 className={authStyles['auth-title']} style={{ color: 'var(--accent-warm)' }}>SECURITY OVERRIDE</h2>
          <p className={authStyles['auth-subtitle']}>Admin Mission Control</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="Admin Master Token" 
              className="text-input"
              style={{ borderColor: 'var(--accent-warm)', color: 'var(--accent-warm)', fontWeight: 'bold' }}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button className="btn-primary" style={{ width: '100%', marginTop: '20px', background: 'var(--accent-warm)', color: '#000' }}>
              Access Feed
            </button>
            {error && <p className="error-msg" style={{ marginTop: '16px' }}>{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
    <main className={`${adminStyles['admin-layout']} container`}>
      <Head><title>AckiMeme - Security Mission Control</title></Head>

      <div className="animate-fade-in">
        <header className={adminStyles['threat-monitor-header']}>
          <div>
            <h1 className={adminStyles['threat-monitor-title']}>
              THREAT<span style={{ color: 'var(--accent-warm)' }}>_MONITOR</span>
            </h1>
            <p className={adminStyles['threat-monitor-subtitle']}>
              Live Network Anomaly Detection System /// Acki Nacki
            </p>
          </div>
          <div className="card" style={{ padding: '8px 16px', borderRadius: '32px', border: '1px solid var(--accent-warm-glow)', color: 'var(--accent-warm)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 'bold' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-warm)', boxShadow: '0 0 8px var(--accent-warm-glow)' }} />
            LIVE SENSORS
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--accent-warm)', overflowX: 'auto' }}>
            <h2 className="info-label" style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--ink)' }}>
               RECENT ANOMALIES
            </h2>
            <table className={adminStyles['monitoring-table']}>
              <thead>
                <tr>
                  <th>Wallet / IP</th>
                  <th>Type</th>
                  <th>Risk Score</th>
                  <th>Triggers</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((ano: any, i: number) => (
                  <tr key={(String(ano.wallet)) || i}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{String(ano.wallet)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{ano.ip}</div>
                    </td>
                    <td>
                      <span className="status-badge" style={{ marginBottom: 0 }}>
                      {ano.timestamp ? new Date(ano.timestamp as string).toLocaleString() : ''}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div className={adminStyles['score-bar-bg']}>
                           <div className={adminStyles['score-bar-fill']} style={{ width: `${ano.score}%` }}></div>
                         </div>
                         <span style={{ fontSize: '11px', color: 'var(--ink-soft)', fontWeight: 800 }}>{ano.score}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(Array.isArray(ano.triggers) ? ano.triggers : []).map((t: any) => <span key={t} className={adminStyles['trigger-tag']}>{t}</span>)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button disabled title="Funcionalidade em desenvolvimento" className="filter-btn" style={{ borderColor: 'var(--line-soft)', color: 'var(--line-soft)', padding: '4px 12px', fontSize: '11px', cursor: 'not-allowed' }}>
                        Ban IP
                      </button>
                    </td>
                  </tr>
                ))}
                {anomalies.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--ink-muted)' }}>
                      No recent anomalies detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
             <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
               <h3 className="info-label" style={{ marginBottom: '20px' }}>Security Mechanisms</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-soft)', paddingBottom: '12px' }}>
                    <span className="info-label" style={{ color: 'var(--ink)' }}>Bonding Curve</span>
                    <span className="hero-accent" style={{ fontSize: '10px' }}>ACTIVE (Linear)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-soft)', paddingBottom: '12px' }}>
                    <span className="info-label" style={{ color: 'var(--ink)' }}>Creator Sell Lock (Anti-rug)</span>
                    <span className="hero-accent" style={{ fontSize: '10px' }}>ON-CHAIN (30 Days post-AMM)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-soft)', paddingBottom: '12px' }}>
                    <span className="info-label" style={{ color: 'var(--ink)' }}>Rate Limiter</span>
                    <span className="hero-accent" style={{ fontSize: '10px' }}>ACTIVE (Per-wallet + Global)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="info-label" style={{ color: 'var(--ink)' }}>Fee Token</span>
                    <span className="hero-accent" style={{ fontSize: '10px' }}>SHELL (Native)</span>
                  </div>
               </div>
             </div>

             <div className="card" style={{ borderLeft: '4px solid var(--accent-warm)' }}>
                <h3 className="info-label" style={{ marginBottom: '16px', color: 'var(--accent-warm)' }}>System Status</h3>
                <p style={{ color: 'var(--ink)', fontSize: '13px', lineHeight: 1.6 }}>
                  Persistent rate limiting active via PostgreSQL. 
                  Session tokens managed via HttpOnly cookies. 
                  TxHash deduplication enforced to prevent double-spend.
                </p>
             </div>
          </div>
        </div>
      </div>
    </main>

    <style jsx>{`
      .animate-fade-in { animation: fadeInUp 0.4s ease both; }
      .error-msg { color: var(--red); text-align: center; }
    `}</style>
    </>
  );
}
