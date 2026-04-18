import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { createAuthChallenge, getSession, logout, verifyAuthChallenge } from "../lib/api";

const SESSION_STORAGE_KEY = "ackimeme_session_token";

function getTelegramInitData() {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData || "";
}

export default function AuthPage() {
  const router = useRouter();
  
  // Sanitiza a query 'from' para mitigar Open Redirect (Issue #34)
  const sanitizeReturnTo = (url) => {
    if (!url || typeof url !== "string") return "/";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
      return "/"; // Previne redicionamento para domínios externos
    }
    return url.startsWith("/") ? url : "/";
  };
  const returnTo = sanitizeReturnTo(router.query.from);

  const [walletAddress, setWalletAddress] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [signature, setSignature] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [session, setSession] = useState(null);
  const [step, setStep] = useState("connect");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession()
      .then((res) => { setSession(res.session); setStep("done"); })
      .catch(() => { /* not logged in */ });
  }, []);

  async function handleGenerateChallenge() {
    if (!walletAddress.trim()) { setError("Enter your Acki Nacki wallet address."); return; }
    setError(""); setLoading(true);
    try {
      const res = await createAuthChallenge({ walletAddress: walletAddress.trim(), telegramInitData: getTelegramInitData() });
      setChallenge(res.challenge);
      setStep("sign");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function connectWithExtension() {
    setError(""); setLoading(true);
    try {
      const { ProviderRpcClient } = await import('everscale-inpage-provider');
      const ever = new ProviderRpcClient();
      
      if (!(await ever.hasProvider())) {
        throw new Error("Nenhuma extensão de carteira TVM encontrada no navegador. Instale a EVER Wallet ou Acki Nacki Wallet.");
      }

      await ever.ensureInitialized();
      const { accountInteraction } = await ever.requestPermissions({ permissions: ['basic', 'accountInteraction'] });
      
      if (!accountInteraction) {
        throw new Error("Conexão cancelada ou negada.");
      }

      const connectedAddress = accountInteraction.address.toString();
      const connectedPubkey = accountInteraction.publicKey;

      // Generates challenge string
      const res = await createAuthChallenge({ 
        walletAddress: connectedAddress, 
        telegramInitData: getTelegramInitData() 
      });
      const challengeMsg = res.challenge.message;

      // Sign the data (base64) using the provider
      const encodedMsg = btoa(unescape(encodeURIComponent(challengeMsg)));
      const signatureResult = await ever.signData({
        data: encodedMsg,
        publicKey: connectedPubkey
      });

      // R-07: Defensive fallback — some provider versions return `signature`
      // instead of `signatureHex`. Use whichever is available.
      const sigHex = signatureResult.signatureHex || signatureResult.signature;
      if (!sigHex) throw new Error("Provider não retornou assinatura válida.");

      // Verification Step
      const authRes = await verifyAuthChallenge({
        challengeId: res.challenge.id,
        walletAddress: connectedAddress,
        publicKey: connectedPubkey,
        signature: sigHex,
        telegramInitData: getTelegramInitData()
      });

      setSession(authRes.session);
      setStep("done");
      setTimeout(() => router.push(String(returnTo)), 1200);

    } catch (err) {
      console.error(err);
      setError(err.message || "Erro na conexão via Wallet Extension.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!publicKey.trim() || !signature.trim()) { setError("Paste the public key and signature."); return; }
    setError(""); setLoading(true);
    try {
      const res = await verifyAuthChallenge({
        challengeId: challenge.id, walletAddress: walletAddress.trim(),
        publicKey: publicKey.trim(), signature: signature.trim(),
        telegramInitData: getTelegramInitData(),
      });
      // Issue #8: Token is now set securely via HttpOnly cookie set by the backend.
      // window.localStorage is no longer used for session tokens.
      setSession(res.session); setStep("done");
      setTimeout(() => router.push(String(returnTo)), 1200);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    await logout().catch(() => {});
    setSession(null); setChallenge(null); setStep("connect");
    setWalletAddress(""); setPublicKey(""); setSignature("");
  }

  return (
    <>
      <Head>
        <title>Connect Wallet | AckiMeme</title>
        <meta name="description" content="Authenticate your wallet to create and trade memecoins on Acki Nacki." />
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
          ) : step === "sign" && challenge ? (
            <div className="animate-fade-in">
              <div className="step-badge">Step 2/2 — Sign the Challenge</div>
              <div className="challenge-box">
                <span className="info-label" style={{ marginBottom: '12px', display: 'block' }}>Message to sign:</span>
                <code className="challenge-msg">{challenge.message}</code>
              </div>
              <p className="token-time" style={{ fontSize: '11px', lineHeight: 1.5, marginBottom: '20px' }}>
                Copy the message, sign with your wallet, then paste the Public Key and Signature below.<br/><br/>
                <b>For Devs (tvm-cli):</b><br/>
                <code style={{ background: 'var(--bg-glass)', padding: '6px', borderRadius: '4px', display: 'block', marginTop: '6px', userSelect: 'all', border: '1px solid var(--line)' }}>
                  tvm-cli sign --wallet {walletAddress} --sign "{challenge.message}"
                </code>
              </p>
              <input className="text-input" placeholder="Public Key (hex)" value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)} autoComplete="off" style={{ marginBottom: '12px' }} />
              <input className="text-input" placeholder="Signature (hex)" value={signature}
                onChange={(e) => setSignature(e.target.value)} autoComplete="off" style={{ marginBottom: '12px' }} />
              {error && <p className="error-msg" style={{ marginBottom: '12px', fontSize: '12px' }}>{error}</p>}
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Connect"}
              </button>
              <button className="filter-btn" style={{ width: '100%', marginTop: '12px' }}
                onClick={() => { setStep("connect"); setChallenge(null); setError(""); }}>
                ← Back
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="step-badge">🚀 Conexão Automática</div>
              <button 
                className="btn-primary" 
                style={{ width: '100%', marginBottom: '24px', backgroundColor: 'var(--accent)', color: '#000' }} 
                onClick={connectWithExtension} 
                disabled={loading}
              >
                {loading ? "Conectando..." : "Connect Extension Wallet"}
              </button>
              
              <div style={{ borderTop: '1px solid var(--line)', margin: '24px 0', position: 'relative' }}>
                <span style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg)', padding: '0 10px', fontSize: '11px', color: 'var(--text-secondary)' }}>ou via tvm-cli</span>
              </div>

              <div className="step-badge">Manual Input (Devs)</div>
              <input className="text-input" placeholder="0:abc123… (Acki Nacki address)" value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)} autoComplete="off" style={{ marginBottom: '12px' }} />
              {error && <p className="error-msg" style={{ marginBottom: '12px', fontSize: '12px' }}>{error}</p>}
              <button className="filter-btn" style={{ width: '100%' }} onClick={handleGenerateChallenge} disabled={loading}>
                {loading ? "Gerando..." : "Generate Manual Challenge"}
              </button>
              <div style={{ borderTop: '1px solid var(--line)', margin: '24px 0' }} />
              <button className="filter-btn" style={{ width: '100%' }} onClick={() => router.push("/")}>← Back to Board</button>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .animate-fade-in { animation: fadeInUp 0.4s ease both; }
        .error-msg { color: var(--red); text-align: center; }
      `}</style>
    </>
  );
}
