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
  const [walletAddress, setWalletAddress] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [signature, setSignature] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [session, setSession] = useState(null);
  const [step, setStep] = useState("connect"); // connect | sign | done
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Carregar sessão existente
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) return;
    getSession(token)
      .then((res) => {
        setSession(res.session);
        setStep("done");
      })
      .catch(() => window.localStorage.removeItem(SESSION_STORAGE_KEY));
  }, []);

  async function handleGenerateChallenge() {
    if (!walletAddress.trim()) {
      setError("Digite o endereço da sua wallet Acki Nacki.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await createAuthChallenge({
        walletAddress: walletAddress.trim(),
        telegramInitData: getTelegramInitData(),
      });
      setChallenge(res.challenge);
      setStep("sign");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!publicKey.trim() || !signature.trim()) {
      setError("Cole a public key e a assinatura geradas pela sua wallet.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await verifyAuthChallenge({
        challengeId: challenge.id,
        walletAddress: walletAddress.trim(),
        publicKey: publicKey.trim(),
        signature: signature.trim(),
        telegramInitData: getTelegramInitData(),
      });
      window.localStorage.setItem(SESSION_STORAGE_KEY, res.session.token);
      setSession(res.session);
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    if (token) await logout(token).catch(() => {});
    setSession(null);
    setChallenge(null);
    setStep("connect");
    setWalletAddress("");
    setPublicKey("");
    setSignature("");
  }

  function handleGoHome() {
    router.push("/");
  }

  return (
    <>
      <Head>
        <title>Connect Wallet | AckiMeme</title>
        <meta name="description" content="Autentique sua wallet Acki Nacki para criar e gerenciar memecoins." />
      </Head>
      <main style={styles.page}>
        <div style={styles.card}>
          {/* Logo / marca */}
          <div style={styles.logo}>⬡ AckiMeme</div>
          <p style={styles.network}>Acki Nacki Blockchain</p>

          {step === "done" && session ? (
            <>
              <div style={styles.successBadge}>✓ Wallet conectada</div>
              <p style={styles.walletText}>
                {session.walletAddress.slice(0, 8)}...{session.walletAddress.slice(-6)}
              </p>
              <p style={styles.hint}>Sessão ativa até o logout ou expiração.</p>
              <button style={styles.btnPrimary} onClick={handleGoHome}>
                [ ir para o board ]
              </button>
              <button style={{ ...styles.btnGhost, marginTop: 10 }} onClick={handleLogout}>
                [ desconectar ]
              </button>
            </>
          ) : step === "sign" && challenge ? (
            <>
              <p style={styles.stepLabel}>passo 2 / 2 — assine o challenge</p>
              <div style={styles.challengeBox}>
                <p style={styles.challengeLabel}>Mensagem para assinar:</p>
                <code style={styles.challengeMsg}>{challenge.message}</code>
              </div>
              <p style={styles.hint}>
                Copie a mensagem acima, assine com sua wallet Acki Nacki e cole a Public Key
                e a Assinatura (hex) abaixo.
              </p>
              <input
                style={styles.input}
                placeholder="Public Key (hex)"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                autoComplete="off"
              />
              <input
                style={styles.input}
                placeholder="Signature (hex)"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                autoComplete="off"
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btnPrimary} onClick={handleVerify} disabled={loading}>
                {loading ? "verificando..." : "[ verificar & conectar ]"}
              </button>
              <button
                style={{ ...styles.btnGhost, marginTop: 10 }}
                onClick={() => { setStep("connect"); setChallenge(null); setError(""); }}
              >
                [ voltar ]
              </button>
            </>
          ) : (
            <>
              <p style={styles.stepLabel}>passo 1 / 2 — endereço da wallet</p>
              <input
                style={styles.input}
                placeholder="0:abc123... (endereço Acki Nacki)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                autoComplete="off"
                autoFocus
              />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.btnPrimary} onClick={handleGenerateChallenge} disabled={loading}>
                {loading ? "gerando challenge..." : "[ gerar challenge ]"}
              </button>
              <div style={styles.divider} />
              <button style={styles.btnGhost} onClick={handleGoHome}>
                [ voltar sem conectar ]
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#09090b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"ui-monospace","SFMono-Regular","Menlo","Monaco",monospace',
    padding: "16px",
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "4px",
    padding: "40px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  logo: {
    fontSize: "22px",
    color: "#86efac",
    fontWeight: "bold",
    marginBottom: "4px",
    letterSpacing: "-0.02em",
  },
  network: {
    fontSize: "11px",
    color: "#52525b",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: "32px",
    marginTop: "2px",
  },
  stepLabel: {
    fontSize: "11px",
    color: "#f97316",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: "20px",
  },
  input: {
    width: "100%",
    background: "#09090b",
    border: "1px solid #27272a",
    borderRadius: "2px",
    color: "#f4f4f5",
    fontFamily: "inherit",
    fontSize: "13px",
    padding: "12px 14px",
    marginBottom: "10px",
    boxSizing: "border-box",
    outline: "none",
  },
  btnPrimary: {
    width: "100%",
    background: "transparent",
    border: "1px solid #86efac",
    color: "#86efac",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: "bold",
    padding: "13px",
    cursor: "pointer",
    borderRadius: "2px",
    marginTop: "6px",
    transition: "background 0.15s, color 0.15s",
  },
  btnGhost: {
    width: "100%",
    background: "transparent",
    border: "1px solid #27272a",
    color: "#71717a",
    fontFamily: "inherit",
    fontSize: "13px",
    padding: "11px",
    cursor: "pointer",
    borderRadius: "2px",
  },
  challengeBox: {
    background: "#09090b",
    border: "1px solid #27272a",
    borderRadius: "2px",
    padding: "14px",
    marginBottom: "14px",
  },
  challengeLabel: {
    fontSize: "10px",
    color: "#71717a",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: "8px",
    marginTop: 0,
  },
  challengeMsg: {
    fontSize: "11px",
    color: "#86efac",
    wordBreak: "break-all",
    lineHeight: "1.6",
    display: "block",
  },
  hint: {
    fontSize: "12px",
    color: "#52525b",
    lineHeight: "1.6",
    marginBottom: "16px",
    marginTop: "4px",
  },
  error: {
    color: "#f87171",
    fontSize: "12px",
    marginBottom: "10px",
    marginTop: 0,
  },
  successBadge: {
    color: "#86efac",
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "12px",
  },
  walletText: {
    fontSize: "13px",
    color: "#a1a1aa",
    marginBottom: "8px",
    wordBreak: "break-all",
  },
  divider: {
    borderTop: "1px solid #27272a",
    margin: "20px 0",
  },
};
