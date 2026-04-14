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
  const returnTo = router.query.from || "/";
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
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) return;
    getSession(token)
      .then((res) => { setSession(res.session); setStep("done"); })
      .catch(() => window.localStorage.removeItem(SESSION_STORAGE_KEY));
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

  async function handleVerify() {
    if (!publicKey.trim() || !signature.trim()) { setError("Paste the public key and signature."); return; }
    setError(""); setLoading(true);
    try {
      const res = await verifyAuthChallenge({
        challengeId: challenge.id, walletAddress: walletAddress.trim(),
        publicKey: publicKey.trim(), signature: signature.trim(),
        telegramInitData: getTelegramInitData(),
      });
      window.localStorage.setItem(SESSION_STORAGE_KEY, res.session.token);
      setSession(res.session); setStep("done");
      setTimeout(() => router.push(String(returnTo)), 1200);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    if (token) await logout(token).catch(() => {});
    setSession(null); setChallenge(null); setStep("connect");
    setWalletAddress(""); setPublicKey(""); setSignature("");
  }

  return (
    <>
      <Head>
        <title>Connect Wallet | AckiMeme</title>
        <meta name="description" content="Authenticate your wallet to create and trade memecoins on Acki Nacki." />
      </Head>
      <main style={s.page}>
        <div style={s.glow} />
        <div style={s.card}>
          <div style={s.logo}>⬡</div>
          <h1 style={s.title}>Connect Wallet</h1>
          <p style={s.network}>Acki Nacki Blockchain</p>

          {step === "done" && session ? (
            <>
              <div style={s.successBadge}>✓ Connected</div>
              <p style={s.walletText}>{session.walletAddress.slice(0, 10)}…{session.walletAddress.slice(-6)}</p>
              <p style={s.hint}>Session active. You can close this page.</p>
              <button style={s.btnPrimary} onClick={() => router.push("/")}>Go to Board →</button>
              <button style={{ ...s.btnGhost, marginTop: 10 }} onClick={handleLogout}>Disconnect</button>
            </>
          ) : step === "sign" && challenge ? (
            <>
              <div style={s.stepBadge}>Step 2/2 — Sign the Challenge</div>
              <div style={s.challengeBox}>
                <p style={s.challengeLabel}>Message to sign:</p>
                <code style={s.challengeMsg}>{challenge.message}</code>
              </div>
              <p style={s.hint}>Copy the message, sign with your wallet, then paste the Public Key and Signature below.</p>
              <input style={s.input} placeholder="Public Key (hex)" value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)} autoComplete="off" />
              <input style={s.input} placeholder="Signature (hex)" value={signature}
                onChange={(e) => setSignature(e.target.value)} autoComplete="off" />
              {error && <p style={s.error}>{error}</p>}
              <button style={s.btnPrimary} onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Connect"}
              </button>
              <button style={{ ...s.btnGhost, marginTop: 10 }}
                onClick={() => { setStep("connect"); setChallenge(null); setError(""); }}>
                ← Back
              </button>
            </>
          ) : (
            <>
              <div style={s.stepBadge}>Step 1/2 — Wallet Address</div>
              <input style={s.input} placeholder="0:abc123… (Acki Nacki address)" value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)} autoComplete="off" autoFocus />
              {error && <p style={s.error}>{error}</p>}
              <button style={s.btnPrimary} onClick={handleGenerateChallenge} disabled={loading}>
                {loading ? "Generating..." : "Generate Challenge"}
              </button>
              <div style={s.divider} />
              <button style={s.btnGhost} onClick={() => router.push("/")}>← Back to Board</button>
            </>
          )}
        </div>
      </main>
    </>
  );
}

const s = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    padding: "24px", position: "relative", overflow: "hidden",
  },
  glow: {
    position: "absolute", top: "-200px", left: "50%", transform: "translateX(-50%)",
    width: "500px", height: "500px",
    background: "radial-gradient(ellipse, rgba(0,255,136,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    width: "100%", maxWidth: "440px", position: "relative",
    background: "rgba(22,22,26,0.8)", border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "16px", padding: "40px 32px",
    display: "flex", flexDirection: "column", backdropFilter: "blur(16px)",
    animation: "fadeInUp 0.3s ease both",
  },
  logo: { fontSize: "32px", color: "#00ff88", filter: "drop-shadow(0 0 8px rgba(0,255,136,0.4))", marginBottom: "12px" },
  title: { fontSize: "22px", fontWeight: 700, color: "#f4f4f5", margin: "0 0 4px" },
  network: {
    fontSize: "10px", color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.14em",
    marginBottom: "28px", fontFamily: "var(--font-mono)",
  },
  stepBadge: {
    fontSize: "10px", color: "#f97316", textTransform: "uppercase", letterSpacing: "0.12em",
    marginBottom: "18px", fontWeight: 600,
  },
  input: {
    width: "100%", background: "rgba(9,9,11,0.6)", border: "1px solid rgba(39,39,42,0.6)",
    borderRadius: "8px", color: "#f4f4f5", fontSize: "13px", padding: "12px 14px",
    marginBottom: "10px", boxSizing: "border-box", fontFamily: "var(--font-mono)",
  },
  btnPrimary: {
    width: "100%", background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000", border: "none", fontSize: "14px", fontWeight: 700,
    padding: "13px", cursor: "pointer", borderRadius: "10px", marginTop: "6px",
    boxShadow: "0 0 20px rgba(0,255,136,0.2)",
  },
  btnGhost: {
    width: "100%", background: "transparent", border: "1px solid #27272a",
    color: "#71717a", fontSize: "13px", padding: "11px", cursor: "pointer", borderRadius: "8px",
  },
  challengeBox: {
    background: "rgba(9,9,11,0.5)", border: "1px solid #27272a",
    borderRadius: "8px", padding: "14px", marginBottom: "14px",
  },
  challengeLabel: {
    fontSize: "9px", color: "#52525b", letterSpacing: "0.12em", textTransform: "uppercase",
    marginBottom: "8px", marginTop: 0,
  },
  challengeMsg: { fontSize: "11px", color: "#00ff88", wordBreak: "break-all", lineHeight: 1.6, display: "block" },
  hint: { fontSize: "12px", color: "#52525b", lineHeight: 1.6, marginBottom: "16px", marginTop: "4px" },
  error: { color: "#ff4757", fontSize: "12px", marginBottom: "10px", marginTop: 0 },
  successBadge: { color: "#00ff88", fontSize: "20px", fontWeight: 700, marginBottom: "12px" },
  walletText: { fontSize: "13px", color: "#a1a1aa", marginBottom: "8px", wordBreak: "break-all", fontFamily: "var(--font-mono)" },
  divider: { borderTop: "1px solid #27272a", margin: "20px 0" },
};
