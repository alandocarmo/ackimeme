import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateQrChallenge, getQrStatus, getSession, logout } from "../lib/api";

export default function AuthPage() {
  const router = useRouter();
  
  const sanitizeReturnTo = (url) => {
    if (!url || typeof url !== "string") return "/";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
      return "/"; 
    }
    return url.startsWith("/") ? url : "/";
  };
  const returnTo = sanitizeReturnTo(router.query.from);

  const [session, setSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [step, setStep] = useState("connect"); // connect, done
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Polling ref
  const pollingRef = useRef(null);
  const stepRef = useRef("connect");
  const qrSessionIdRef = useRef("");

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    qrSessionIdRef.current = qrData?.sessionId || "";
  }, [qrData]);

  // 1. On Mount: Check if logged in, otherwise start QR Session
  useEffect(() => {
    if (typeof window === "undefined") return;

    getSession()
      .then((res) => { 
        setSession(res.session); 
        setStep("done"); 
        setLoading(false);
      })
      .catch(() => { 
        // Not logged in. Initialize QR Code
        initQrLogin();
      });

    // Audit #26: Pause polling when tab is hidden to save bandwidth
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else if (stepRef.current !== "done" && qrSessionIdRef.current) {
        startPolling(qrSessionIdRef.current);
      }
      // Polling resumes automatically when initQrLogin is called or on next user interaction
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const initQrLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await generateQrChallenge();
      setQrData({ sessionId: res.sessionId, deepLink: res.deepLink });
      qrSessionIdRef.current = res.sessionId;
      setStep("connect");
      startPolling(res.sessionId);
    } catch (err) {
      setError("Falha ao gerar o QR Code de autenticação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId) => {
    const effectiveSessionId = sessionId || qrSessionIdRef.current;
    if (!effectiveSessionId) return;

    stopPolling(); // Ensure clean state
    qrSessionIdRef.current = effectiveSessionId;
    let attempts = 0;
    const MAX_ATTEMPTS = 120; // ~5 minutos a 2.5s cada
    
    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        stopPolling();
        setError("Tempo de espera expirado. Clique abaixo para gerar novo QR.");
        return;
      }
      try {
        const statusRes = await getQrStatus(effectiveSessionId);
        if (statusRes.status === 'done') {
          // Polling success! App notified webhook
          stopPolling();
          qrSessionIdRef.current = "";
          
          // Re-fetch the session properly to populate UI, or just trust the new cookie
          // We can call getSession() to get real user data now
          try {
            const sessionRes = await getSession();
            setSession(sessionRes.session);
            window.dispatchEvent(new Event('session-changed'));
            setStep("done");
            setTimeout(() => router.push(String(returnTo)), 1200);
          } catch {
            setError("Login QR concluído, mas a sessão ainda não propagou. Tente novamente em alguns segundos.");
            setTimeout(() => initQrLogin(), 2000);
          }
        } else if (statusRes.status === 'expired') {
          stopPolling();
          setError("QR Code expirado. Geração de novo desafio...");
          setTimeout(() => initQrLogin(), 2000);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2500); // Poll every 2.5 seconds
  };

  // Dev simulation removed for production.

  async function handleLogout() {
    await logout().catch(() => {});
    setSession(null); 
    window.dispatchEvent(new Event('session-changed'));
    setStep("connect");
    initQrLogin();
  }

  return (
    <>
      <Head>
        <title>Connect Wallet | AckiMeme</title>
        <meta name="description" content="Authenticate your wallet using Acki Nacki App" />
      </Head>
      <main className="auth-layout">
        <div className="hero-glow" style={{ position: 'fixed', top: '50%', transform: 'translate(-50%, -50%)' }} />
        <div className="auth-card">
          <div className="auth-logo">⬡</div>
          <h1 className="auth-title">Connect Wallet</h1>
          <p className="auth-subtitle">Acki Nacki Blockchain</p>

          {step === "done" && session ? (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <div className="hero-accent" style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>✓ Connected</div>
              <p className="token-ticker" style={{ fontSize: '14px', marginBottom: '8px' }}>
                {session.walletAddress.slice(0, 10)}…{session.walletAddress.slice(-6)}
              </p>
              <p className="token-time" style={{ marginBottom: '24px' }}>Session active. You can close this page.</p>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => router.push("/")}>Go to Board →</button>
              <button className="filter-btn" style={{ width: '100%', marginTop: '12px' }} onClick={handleLogout}>Disconnect</button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="step-badge">Scan to Connect</div>
              
              <div className="qr-container" style={{ margin: '24px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                {loading ? (
                  <p className="token-time">Generating secure connection...</p>
                ) : qrData ? (
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '12px' }}>
                    <QRCodeSVG 
                      value={qrData.deepLink} 
                      size={220}
                      bgColor={"#ffffff"}
                      fgColor={"#000000"}
                      level={"L"}
                      includeMargin={false}
                    />
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="error-msg" style={{ marginBottom: '16px', fontSize: '12px', textAlign: 'center' }}>{error}</p>
              ) : (
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <p className="token-time" style={{ marginBottom: '8px' }}>
                    Open your <b>Acki Nacki Wallet</b> app<br/>and scan this QR Code to log in.
                  </p>
                  {qrData?.deepLink && (
                    <p className="token-time" style={{ fontSize: '14px' }}>
                      Or <a href={qrData.deepLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>click here to open Telegram</a>
                    </p>
                  )}
                </div>
              )}
              
              {/* Dev Tools removed */}

              <div style={{ borderTop: '1px solid var(--line)', margin: '24px 0' }} />
              <button className="filter-btn" style={{ width: '100%', borderColor: 'transparent', background: 'transparent' }} onClick={() => router.push("/")}>← Back to Board</button>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .animate-fade-in { animation: fadeInUp 0.4s ease both; }
        .error-msg { color: var(--red); text-align: center; }
        .qr-container { transition: all 0.3s ease; }
      `}</style>
    </>
  );
}
