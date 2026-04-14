import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  createLaunchRequest,
  getConfig,
  getSession,
  verifyPayment,
} from "../lib/api";

const SESSION_KEY = "ackimeme_session_token";

function sanitizeSymbol(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function formatSupply(v) {
  const d = String(v || "").replace(/[^\d]/g, "");
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";
}

export default function CreatePage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [token, setToken] = useState("");
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1); // 1=info, 2=pay, 3=confirm
  const [form, setForm] = useState({
    name: "", symbol: "", tagline: "", description: "",
    totalSupply: "1000000000", logoUrl: "",
    website: "", xUrl: "", telegramUrl: "",
    txHash: "", paymentTokenSymbol: "USDC",
  });
  const [paymentStatus, setPaymentStatus] = useState({ ok: false, msg: "" });
  const [launchStatus, setLaunchStatus] = useState({ loading: false, error: "", success: false, ticket: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.localStorage.getItem(SESSION_KEY);
    if (!t) return;
    setToken(t);
    getSession(t).then((r) => setSession(r.session)).catch(() => {});
  }, []);

  useEffect(() => {
    getConfig()
      .then((c) => {
        setConfig(c);
        const defaultFeeToken = c?.payment?.creationFees?.[0]?.tokenSymbol;
        if (defaultFeeToken) {
          setForm((prev) => ({ ...prev, paymentTokenSymbol: defaultFeeToken }));
        }
      })
      .catch(() => {});
  }, []);

  function updateField(field, value) {
    const v = field === "symbol" ? sanitizeSymbol(value) : value;
    setForm((prev) => ({ ...prev, [field]: v }));
  }

  const feeWallet = config?.payment?.feeWallet || "Loading...";
  const fee = config?.payment?.creationFees?.[0] || { tokenSymbol: "USDC", minimumAmount: 3 };
  const blockchainFee = config?.payment?.blockchainFee || { tokenSymbol: "SHELL", minimumCreatorBalance: 1 };

  const canStep2 = form.name.trim().length >= 2 && sanitizeSymbol(form.symbol).length >= 2 &&
    form.description.trim().length >= 20 && form.totalSupply.trim();

  async function handleVerifyPayment() {
    setPaymentStatus({ ok: false, msg: "Checking blockchain..." });
    try {
      await verifyPayment({
        walletAddress: session?.walletAddress,
        txHash: form.txHash.trim(),
        tokenSymbol: form.paymentTokenSymbol,
      });
      setPaymentStatus({ ok: true, msg: "Payment confirmed ✓" });
    } catch (err) {
      setPaymentStatus({ ok: false, msg: err.message });
    }
  }

  async function handleLaunch() {
    setLaunchStatus({ loading: true, error: "", success: false, ticket: null });
    try {
      const res = await createLaunchRequest(
        { ...form, creatorWallet: session?.walletAddress, symbol: sanitizeSymbol(form.symbol) },
        token,
      );
      setLaunchStatus({ loading: false, error: "", success: true, ticket: res.launchRequest });
    } catch (err) {
      setLaunchStatus({ loading: false, error: err.message, success: false, ticket: null });
    }
  }

  if (!session) {
    return (
      <>
        <Head><title>Create Coin | AckiMeme</title></Head>
        <main style={s.page}>
          <div style={s.connectCard}>
            <p style={s.connectIcon}>🔒</p>
            <h2 style={s.connectTitle}>Connect your wallet first</h2>
            <p style={s.connectSub}>You need to authenticate to create a memecoin.</p>
            <Link href="/auth?from=/create" style={s.connectBtn}>Connect Wallet</Link>
          </div>
        </main>
      </>
    );
  }

  // Success screen
  if (launchStatus.success && launchStatus.ticket) {
    return (
      <>
        <Head><title>🚀 Launched! | AckiMeme</title></Head>
        <main style={s.page}>
          <div style={s.successCard}>
            <div style={s.rocketAnim}>🚀</div>
            <h2 style={s.successTitle}>Your coin is live!</h2>
            <p style={s.successTicker}>${sanitizeSymbol(form.symbol)}</p>
            <p style={s.successSub}>{form.name} is now on the AckiMeme bonding curve.</p>
            <div style={s.successActions}>
              <Link href={`/token/${launchStatus.ticket.id}`} style={s.successBtnPrimary}>
                View Token Page →
              </Link>
              <Link href="/" style={s.successBtnGhost}>Back to Board</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Create Coin | AckiMeme</title>
        <meta name="description" content="Launch your own memecoin on Acki Nacki with bonding curve." />
      </Head>

      <main style={s.page}>
        <div style={s.container}>
          {/* Steps indicator */}
          <div style={s.steps}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={s.stepItem}>
                <div style={step >= n ? s.stepCircleActive : s.stepCircle}>{n}</div>
                <span style={step >= n ? s.stepNameActive : s.stepName}>
                  {n === 1 ? "Token Info" : n === 2 ? "Payment" : "Launch"}
                </span>
              </div>
            ))}
            <div style={s.stepLine} />
          </div>

          {/* Step 1: Token Info */}
          {step === 1 && (
            <div style={s.formCard}>
              <h2 style={s.formTitle}>Token Details</h2>
              <p style={s.formSub}>Set up your memecoin identity.</p>

              <div style={s.fieldGrid}>
                <label style={s.fieldWrap}>
                  <span style={s.label}>Token Name *</span>
                  <input style={s.input} maxLength={32} value={form.name}
                    onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. AckiDoge" />
                </label>
                <label style={s.fieldWrap}>
                  <span style={s.label}>Ticker *</span>
                  <input style={s.input} maxLength={10} value={form.symbol}
                    onChange={(e) => updateField("symbol", e.target.value)} placeholder="e.g. ADOGE" />
                </label>
                <label style={{ ...s.fieldWrap, gridColumn: "1 / -1" }}>
                  <span style={s.label}>Tagline</span>
                  <input style={s.input} value={form.tagline}
                    onChange={(e) => updateField("tagline", e.target.value)} placeholder="One line about your coin" />
                </label>
                <label style={{ ...s.fieldWrap, gridColumn: "1 / -1" }}>
                  <span style={s.label}>Description * (min 20 chars)</span>
                  <textarea style={s.textarea} maxLength={280} value={form.description}
                    onChange={(e) => updateField("description", e.target.value)} placeholder="What's your coin about?" rows={3} />
                  <span style={s.charCount}>{form.description.length}/280</span>
                </label>
                <label style={s.fieldWrap}>
                  <span style={s.label}>Total Supply</span>
                  <input style={s.input} inputMode="numeric" value={form.totalSupply}
                    onChange={(e) => updateField("totalSupply", e.target.value)} />
                  <span style={s.hint}>{formatSupply(form.totalSupply)} tokens</span>
                </label>
                <label style={s.fieldWrap}>
                  <span style={s.label}>Logo URL</span>
                  <input style={s.input} value={form.logoUrl}
                    onChange={(e) => updateField("logoUrl", e.target.value)} placeholder="https://..." />
                </label>
              </div>

              {/* Socials */}
              <h3 style={s.subTitle}>Social Links (optional)</h3>
              <div style={s.fieldGrid}>
                <label style={s.fieldWrap}>
                  <span style={s.label}>🌐 Website</span>
                  <input style={s.input} value={form.website} onChange={(e) => updateField("website", e.target.value)} />
                </label>
                <label style={s.fieldWrap}>
                  <span style={s.label}>𝕏 Twitter</span>
                  <input style={s.input} value={form.xUrl} onChange={(e) => updateField("xUrl", e.target.value)} />
                </label>
                <label style={s.fieldWrap}>
                  <span style={s.label}>✈ Telegram</span>
                  <input style={s.input} value={form.telegramUrl} onChange={(e) => updateField("telegramUrl", e.target.value)} />
                </label>
              </div>

              <button style={canStep2 ? s.nextBtn : s.nextBtnDisabled} disabled={!canStep2}
                onClick={() => setStep(2)}>
                Continue to Payment →
              </button>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div style={s.formCard}>
              <h2 style={s.formTitle}>Pay Creation Fee</h2>
              <p style={s.formSub}>Send the fee to list your coin on the board.</p>

              <div style={s.feeBox}>
                <div style={s.feeRow}>
                  <span style={s.feeLabel}>Amount</span>
                  <span style={s.feeValue}>{fee.minimumAmount} {fee.tokenSymbol}</span>
                </div>
                <div style={s.feeRow}>
                  <span style={s.feeLabel}>Send to</span>
                  <code style={s.feeWallet}>{feeWallet}</code>
                </div>
              </div>
              <p style={s.hintNotice}>
                Network cost is paid separately by the creator wallet in {blockchainFee.tokenSymbol}.
                Keep at least {blockchainFee.minimumCreatorBalance} {blockchainFee.tokenSymbol} available.
              </p>

              <label style={{ ...s.fieldWrap, marginTop: "20px" }}>
                <span style={s.label}>Transaction Hash</span>
                <input style={s.input} value={form.txHash} placeholder="Paste your tx hash after sending"
                  onChange={(e) => updateField("txHash", e.target.value)} />
              </label>

              {paymentStatus.msg && (
                <p style={paymentStatus.ok ? s.successMsg : s.errorMsg}>{paymentStatus.msg}</p>
              )}

              <div style={s.btnRow}>
                <button style={s.backBtn} onClick={() => setStep(1)}>← Back</button>
                <button style={form.txHash.trim() ? s.nextBtn : s.nextBtnDisabled}
                  disabled={!form.txHash.trim()} onClick={handleVerifyPayment}>
                  Verify Payment
                </button>
              </div>

              {paymentStatus.ok && (
                <button style={{ ...s.nextBtn, marginTop: "12px" }} onClick={() => setStep(3)}>
                  Continue to Launch →
                </button>
              )}
            </div>
          )}

          {/* Step 3: Preview & Launch */}
          {step === 3 && (
            <div style={s.formCard}>
              <h2 style={s.formTitle}>🚀 Ready to Launch</h2>
              <p style={s.formSub}>Review your token and hit launch.</p>

              <div style={s.previewCard}>
                <div style={s.previewRow}>
                  <span style={s.previewLabel}>Name</span>
                  <span style={s.previewValue}>{form.name}</span>
                </div>
                <div style={s.previewRow}>
                  <span style={s.previewLabel}>Ticker</span>
                  <span style={{ ...s.previewValue, color: "#00ff88", fontFamily: "var(--font-mono)" }}>${sanitizeSymbol(form.symbol)}</span>
                </div>
                <div style={s.previewRow}>
                  <span style={s.previewLabel}>Supply</span>
                  <span style={s.previewValue}>{formatSupply(form.totalSupply)}</span>
                </div>
                <div style={s.previewRow}>
                  <span style={s.previewLabel}>Payment</span>
                  <span style={s.previewValue}>✓ Verified</span>
                </div>
              </div>

              {launchStatus.error && <p style={s.errorMsg}>{launchStatus.error}</p>}

              <div style={s.btnRow}>
                <button style={s.backBtn} onClick={() => setStep(2)}>← Back</button>
                <button style={s.launchBtn} disabled={launchStatus.loading} onClick={handleLaunch}>
                  {launchStatus.loading ? "Deploying..." : "🚀 Launch Coin"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    padding: "40px 24px 80px",
    display: "flex",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: "560px",
  },
  // Steps
  steps: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "32px",
    marginBottom: "36px",
    position: "relative",
  },
  stepItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    position: "relative",
    zIndex: 1,
  },
  stepCircle: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "#1e1e22", border: "2px solid #27272a", color: "#52525b",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: 700,
  },
  stepCircleActive: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    border: "2px solid #00ff88", color: "#000",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: 700,
    boxShadow: "0 0 16px rgba(0,255,136,0.3)",
  },
  stepName: { color: "#52525b", fontSize: "11px", fontWeight: 500 },
  stepNameActive: { color: "#00ff88", fontSize: "11px", fontWeight: 600 },
  stepLine: {
    position: "absolute", top: "16px", left: "25%", right: "25%",
    height: "2px", background: "#27272a", zIndex: 0,
  },
  // Form card
  formCard: {
    background: "rgba(22,22,26,0.7)",
    border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "16px",
    padding: "32px",
    backdropFilter: "blur(12px)",
    animation: "fadeInUp 0.3s ease both",
  },
  formTitle: {
    fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: "#f4f4f5",
  },
  formSub: { color: "#71717a", fontSize: "13px", margin: "0 0 24px" },
  subTitle: { color: "#a1a1aa", fontSize: "13px", fontWeight: 600, margin: "24px 0 12px" },
  fieldGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px",
  },
  fieldWrap: {
    display: "flex", flexDirection: "column", gap: "5px", position: "relative",
  },
  label: {
    color: "#71717a", fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  input: {
    background: "rgba(9,9,11,0.6)", border: "1px solid rgba(39,39,42,0.6)",
    borderRadius: "8px", color: "#f4f4f5", fontSize: "14px", padding: "10px 12px",
    transition: "border-color 0.15s",
  },
  textarea: {
    background: "rgba(9,9,11,0.6)", border: "1px solid rgba(39,39,42,0.6)",
    borderRadius: "8px", color: "#f4f4f5", fontSize: "14px", padding: "10px 12px",
    resize: "vertical", minHeight: "80px",
  },
  charCount: { color: "#3f3f46", fontSize: "10px", textAlign: "right", fontFamily: "var(--font-mono)" },
  hint: { color: "#52525b", fontSize: "11px", fontFamily: "var(--font-mono)" },
  hintNotice: {
    color: "#71717a",
    fontSize: "11px",
    lineHeight: 1.5,
    marginTop: "10px",
  },
  nextBtn: {
    width: "100%", marginTop: "24px", padding: "14px",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000", border: "none", borderRadius: "10px",
    fontWeight: 700, fontSize: "14px", cursor: "pointer",
    boxShadow: "0 0 20px rgba(0,255,136,0.2)",
    transition: "transform 0.1s",
  },
  nextBtnDisabled: {
    width: "100%", marginTop: "24px", padding: "14px",
    background: "#27272a", color: "#52525b", border: "none",
    borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: "not-allowed",
  },
  backBtn: {
    padding: "12px 20px", background: "transparent", color: "#71717a",
    border: "1px solid #27272a", borderRadius: "8px", fontSize: "13px",
    cursor: "pointer", fontWeight: 500,
  },
  btnRow: { display: "flex", gap: "12px", marginTop: "24px" },
  // Fee
  feeBox: {
    background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)",
    borderRadius: "10px", padding: "18px",
  },
  feeRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 0",
  },
  feeLabel: { color: "#71717a", fontSize: "12px" },
  feeValue: { color: "#00ff88", fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-mono)" },
  feeWallet: {
    color: "#a1a1aa", fontSize: "10px", fontFamily: "var(--font-mono)",
    wordBreak: "break-all", maxWidth: "280px", textAlign: "right",
  },
  successMsg: { color: "#00ff88", fontSize: "13px", marginTop: "10px", fontWeight: 500 },
  errorMsg: { color: "#ff4757", fontSize: "13px", marginTop: "10px" },
  // Preview
  previewCard: {
    background: "rgba(9,9,11,0.5)", border: "1px solid #27272a",
    borderRadius: "10px", padding: "18px",
  },
  previewRow: {
    display: "flex", justifyContent: "space-between", padding: "8px 0",
    borderBottom: "1px solid rgba(39,39,42,0.3)",
  },
  previewLabel: { color: "#71717a", fontSize: "12px" },
  previewValue: { color: "#f4f4f5", fontSize: "13px", fontWeight: 600 },
  launchBtn: {
    flex: 1, padding: "14px",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000", border: "none", borderRadius: "10px",
    fontWeight: 700, fontSize: "15px", cursor: "pointer",
    boxShadow: "0 0 24px rgba(0,255,136,0.3)",
  },
  // Connect / Success screens
  connectCard: {
    textAlign: "center", maxWidth: "400px", margin: "80px auto",
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(39,39,42,0.5)",
    borderRadius: "16px", padding: "48px 32px", backdropFilter: "blur(12px)",
  },
  connectIcon: { fontSize: "36px", margin: "0 0 12px" },
  connectTitle: { color: "#f4f4f5", fontSize: "18px", fontWeight: 700, margin: "0 0 8px" },
  connectSub: { color: "#71717a", fontSize: "13px", margin: "0 0 24px" },
  connectBtn: {
    display: "inline-block", background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000", fontWeight: 700, padding: "12px 28px", borderRadius: "10px",
    textDecoration: "none", boxShadow: "0 0 20px rgba(0,255,136,0.2)",
  },
  successCard: {
    textAlign: "center", maxWidth: "440px", margin: "60px auto",
    background: "rgba(22,22,26,0.7)", border: "1px solid rgba(0,255,136,0.2)",
    borderRadius: "16px", padding: "48px 32px", backdropFilter: "blur(12px)",
    animation: "fadeInUp 0.4s ease both",
  },
  rocketAnim: {
    fontSize: "52px", margin: "0 0 16px",
    animation: "fadeInUp 0.5s ease both",
  },
  successTitle: { color: "#00ff88", fontSize: "24px", fontWeight: 700, margin: "0 0 8px" },
  successTicker: {
    color: "#f4f4f5", fontSize: "28px", fontWeight: 700,
    fontFamily: "var(--font-mono)", margin: "0 0 8px",
  },
  successSub: { color: "#71717a", fontSize: "13px", margin: "0 0 28px" },
  successActions: { display: "flex", flexDirection: "column", gap: "10px" },
  successBtnPrimary: {
    display: "block", background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    color: "#000", fontWeight: 700, padding: "14px 24px", borderRadius: "10px",
    textDecoration: "none", textAlign: "center",
  },
  successBtnGhost: {
    display: "block", background: "transparent", color: "#71717a",
    border: "1px solid #27272a", padding: "12px 24px", borderRadius: "10px",
    textDecoration: "none", textAlign: "center",
  },
};
