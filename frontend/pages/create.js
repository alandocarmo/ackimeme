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
    txHash: "",
  });
  const [paymentStatus, setPaymentStatus] = useState({ ok: false, msg: "" });
  const [launchStatus, setLaunchStatus] = useState({ loading: false, error: "", success: false, ticket: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then((r) => setSession(r.session)).catch(() => {});
  }, []);

  useEffect(() => {
    getConfig()
      .then((c) => {
        setConfig(c);
      })
      .catch(() => {});
  }, []);

  function updateField(field, value) {
    let v = value;
    if (field === "symbol") {
      v = sanitizeSymbol(value);
    } else if (field === "totalSupply") {
      v = String(value || "").replace(/[^\d]/g, "");
    }
    setForm((prev) => ({ ...prev, [field]: v }));
  }

  const feeWallet = config?.payment?.feeWallet || "Loading...";
  const fee = config?.payment?.creationFees?.[0] || { tokenSymbol: "SHELL", minimumAmount: 3 };
  const blockchainFee = config?.payment?.blockchainFee || { tokenSymbol: "SHELL", minimumCreatorBalance: 1 };

  const canStep2 = form.name.trim().length >= 2 && sanitizeSymbol(form.symbol).length >= 2 &&
    form.description.trim().length >= 20 && form.totalSupply.trim();

  async function handleVerifyPayment() {
    setPaymentStatus({ ok: false, msg: "Checking blockchain..." });
    try {
      await verifyPayment({
        walletAddress: session?.walletAddress,
        txHash: form.txHash.trim(),
        tokenSymbol: "SHELL",
      });
      setPaymentStatus({ ok: true, msg: "Payment confirmed ✓" });
    } catch (err) {
      setPaymentStatus({ ok: false, msg: err.message });
    }
  }

  async function handleLaunch() {
    setLaunchStatus({ loading: true, error: "", success: false, ticket: null });
    try {
      const res = await createLaunchRequest({
        ...form, creatorWallet: session?.walletAddress, symbol: sanitizeSymbol(form.symbol)
      });
      setLaunchStatus({ loading: false, error: "", success: true, ticket: res.launchRequest });
    } catch (err) {
      setLaunchStatus({ loading: false, error: err.message, success: false, ticket: null });
    }
  }

  if (!session) {
    return (
      <>
        <Head><title>Create Coin | AckiMeme</title></Head>
        <main className="auth-layout">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</p>
            <h2 className="form-title">Connect your wallet first</h2>
            <p className="form-subtitle">You need to authenticate to create a memecoin.</p>
            <Link href="/auth?from=/create" className="btn-primary" style={{ width: '100%' }}>Connect Wallet</Link>
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
        <main className="page-wrapper container">
          <div className="success-card">
            <div className="rocket-icon">🚀</div>
            <h2 className="success-title">Your coin is live!</h2>
            <p className="success-ticker">${sanitizeSymbol(form.symbol)}</p>
            <p className="form-subtitle">{form.name} is now on the AckiMeme bonding curve.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
              <Link href={`/token/${launchStatus.ticket.id}`} className="btn-primary">
                View Token Page →
              </Link>
              <Link href="/" className="filter-btn" style={{ textAlign: 'center' }}>Back to Board</Link>
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

      <main className="page-wrapper container" style={{ paddingTop: '40px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Steps indicator */}
          <div className="stepper">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`step-item ${step >= n ? "active" : ""}`}>
                <div className="step-circle">{n}</div>
                <span className="step-name">
                  {n === 1 ? "Info" : n === 2 ? "Pay" : "Launch"}
                </span>
              </div>
            ))}
            <div className="step-line" />
          </div>

          {(
            <div className="card">
              {/* Step 1: Token Info */}
              {step === 1 && (
                <div className="animate-fade-in">
                  <h2 className="form-title">Token Details</h2>
                  <p className="form-subtitle">Set up your memecoin identity.</p>

                  <div className="field-grid">
                    <label>
                      <span className="input-label">Token Name *</span>
                      <input className="text-input" maxLength={32} value={form.name}
                        onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. AckiDoge" />
                    </label>
                    <label>
                      <span className="input-label">Ticker *</span>
                      <input className="text-input" maxLength={10} value={form.symbol}
                        onChange={(e) => updateField("symbol", e.target.value)} placeholder="e.g. ADOGE" />
                    </label>
                  </div>

                  <div className="field-grid full">
                    <label>
                      <span className="input-label">Tagline</span>
                      <input className="text-input" value={form.tagline}
                        onChange={(e) => updateField("tagline", e.target.value)} placeholder="One line about your coin" />
                    </label>
                    <label>
                      <span className="input-label">Description * (min 20 chars)</span>
                      <textarea className="text-area" maxLength={280} value={form.description}
                        onChange={(e) => updateField("description", e.target.value)} placeholder="What's your coin about?" rows={3} />
                      <span className="input-hint" style={{ textAlign: 'right' }}>{form.description.length}/280</span>
                    </label>
                  </div>

                  <div className="field-grid">
                    <label>
                      <span className="input-label">Total Supply</span>
                      <input className="text-input" inputMode="numeric" value={form.totalSupply}
                        onChange={(e) => updateField("totalSupply", e.target.value)} />
                      <span className="input-hint">{formatSupply(form.totalSupply)} tokens</span>
                    </label>
                    <label>
                      <span className="input-label">Logo URL</span>
                      <input className="text-input" value={form.logoUrl}
                        onChange={(e) => updateField("logoUrl", e.target.value)} placeholder="https://..." />
                    </label>
                  </div>

                  {/* Socials */}
                  <h3 className="input-label" style={{ marginTop: '32px', marginBottom: '16px', color: 'var(--ink)' }}>Social Links (optional)</h3>
                  <div className="field-grid">
                    <label>
                      <span className="input-label">🌐 Website</span>
                      <input className="text-input" value={form.website} onChange={(e) => updateField("website", e.target.value)} />
                    </label>
                    <label>
                      <span className="input-label">𝕏 Twitter</span>
                      <input className="text-input" value={form.xUrl} onChange={(e) => updateField("xUrl", e.target.value)} />
                    </label>
                    <label>
                      <span className="input-label">✈ Telegram</span>
                      <input className="text-input" value={form.telegramUrl} onChange={(e) => updateField("telegramUrl", e.target.value)} />
                    </label>
                  </div>

                  <button className={`btn-primary ${!canStep2 ? "trade-locked" : ""}`} 
                    disabled={!canStep2} style={{ width: '100%', marginTop: '32px' }}
                    onClick={() => setStep(2)}>
                    Continue to Payment →
                  </button>
                </div>
              )}

              {/* Step 2: Payment */}
              {step === 2 && (
                <div className="animate-fade-in">
                  <h2 className="form-title">Pay Creation Fee</h2>
                  <p className="form-subtitle">Send the fee to list your coin on the board.</p>

                  <div className="card" style={{ background: 'var(--accent-glow)', borderColor: 'var(--accent)', marginBottom: '24px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span className="info-label">Creation Fee</span>
                      <span className="info-value" style={{ color: 'var(--accent)' }}>{fee.minimumAmount} {fee.tokenSymbol} (~$3 USD)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span className="info-label">Blockchain Gas</span>
                      <span className="info-value" style={{ color: 'var(--ink-soft)' }}>~{blockchainFee.minimumCreatorBalance} {blockchainFee.tokenSymbol} (variable)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '12px', borderTop: '1px solid var(--line-soft)' }}>
                      <span className="info-label">Send to</span>
                      <code className="token-time" style={{ maxWidth: '240px', textAlign: 'right', wordBreak: 'break-all' }}>{feeWallet}</code>
                    </div>
                  </div>

                  <div className="card" style={{ background: 'var(--bg-deep)', padding: '16px', marginBottom: '20px' }}>
                    <p className="token-time" style={{ fontSize: '11px', lineHeight: 1.6, margin: 0 }}>
                      <strong style={{ color: 'var(--ink)' }}>⚡ How it works:</strong><br/>
                      1. Send <strong>{fee.minimumAmount} SHELL</strong> to the fee wallet above<br/>
                      2. Paste the transaction hash below to verify<br/>
                      3. Your wallet also needs <strong>~{blockchainFee.minimumCreatorBalance}+ SHELL</strong> for blockchain gas fees<br/>
                      <br/>
                      Both the creation fee and gas fees are paid in <strong>SHELL</strong> — the native token of Acki Nacki.
                    </p>
                  </div>

                  <p className="token-time" style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px' }}>
                    Don't have SHELL yet? <Link href="/buy-shell?from=/create" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Buy with card or crypto →</Link>
                  </p>

                  <label style={{ display: 'block', marginTop: '24px' }}>
                    <span className="input-label">Transaction Hash</span>
                    <input className="text-input" value={form.txHash} placeholder="Paste your tx hash after sending"
                      onChange={(e) => updateField("txHash", e.target.value)} />
                  </label>

                  {paymentStatus.msg && (
                    <p className={paymentStatus.ok ? "hero-accent" : "error-msg"} style={{ fontSize: '13px', marginTop: '12px', fontWeight: 600 }}>
                      {paymentStatus.msg}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                    <button className="filter-btn" onClick={() => setStep(1)} style={{ padding: '12px 24px' }}>← Back</button>
                    <button className={`btn-primary ${!form.txHash.trim() ? "trade-locked" : ""}`}
                      disabled={!form.txHash.trim()} onClick={handleVerifyPayment} style={{ flex: 1 }}>
                      Verify Payment
                    </button>
                  </div>

                  {paymentStatus.ok && (
                    <button className="btn-primary" style={{ width: '100%', marginTop: '12px' }} onClick={() => setStep(3)}>
                      Continue to Launch →
                    </button>
                  )}
                </div>
              )}

              {/* Step 3: Preview & Launch */}
              {step === 3 && (
                <div className="animate-fade-in">
                  <h2 className="form-title">🚀 Ready to Launch</h2>
                  <p className="form-subtitle">Review your token and hit launch.</p>

                  <div className="card" style={{ background: 'var(--bg-deep)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span className="info-label">Name</span>
                      <span className="info-value" style={{ fontSize: '14px' }}>{form.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span className="info-label">Ticker</span>
                      <span className="info-value" style={{ fontSize: '14px', color: 'var(--accent)' }}>${sanitizeSymbol(form.symbol)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                      <span className="info-label">Supply</span>
                      <span className="info-value" style={{ fontSize: '14px' }}>{formatSupply(form.totalSupply)}</span>
                    </div>
                  </div>

                  {launchStatus.error && <p className="error-msg" style={{ marginBottom: '20px' }}>{launchStatus.error}</p>}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="filter-btn" onClick={() => setStep(2)} style={{ padding: '12px 24px' }}>← Back</button>
                    <button className="btn-primary" disabled={launchStatus.loading} onClick={handleLaunch} style={{ flex: 1 }}>
                      {launchStatus.loading ? "Deploying..." : "🚀 Launch Coin"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .animate-fade-in { animation: fadeInUp 0.4s ease both; }
        .error-msg { color: var(--red); }
      `}</style>
    </>
  );
}
