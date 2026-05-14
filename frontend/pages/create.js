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
import { formatNum, getSlopeLabel, sliderToSlopeDivisor, slopeDivisorToSlider } from "../lib/utils";
import { useI18n } from "../lib/i18n";

function sanitizeSymbol(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

// formatNum will be used instead

export default function CreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [token, setToken] = useState("");
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1); // 1=info, 2=pay, 3=confirm
  const [form, setForm] = useState({
    name: "", symbol: "", tagline: "", description: "",
    totalSupply: "1000000000", logoUrl: "",
    website: "", xUrl: "", telegramUrl: "",
    txHash: "", pumpForever: false, isBoosted: false, slopeDivisor: 10_000_000_000_000,
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

  const requiredFee = form.isBoosted ? fee.minimumAmount + 500 : fee.minimumAmount;

  async function handleVerifyPayment() {
    setPaymentStatus({ ok: false, msg: "Checking blockchain..." });
    try {
      await verifyPayment({
        walletAddress: session?.walletAddress,
        txHash: form.txHash.trim(),
        tokenSymbol: "SHELL",
        isBoosted: form.isBoosted,
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
        <Head><title>{t("create_title")} | AckiMeme</title></Head>
        <main className="auth-layout">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</p>
            <h2 className="form-title">{t("auth_title")}</h2>
            <p className="form-subtitle">{t("auth_subtitle")}</p>
            <Link href="/auth?from=/create" className="btn-primary" style={{ width: '100%' }}>{t("nav_connect")}</Link>
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
              <Link href="/" className="filter-btn" style={{ textAlign: 'center' }}>{t("detail_back")}</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t("create_title")} | AckiMeme</title>
        <meta name="description" content={t("create_subtitle")} />
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

          <div className="card">
              {/* Step 1: Token Info */}
              {step === 1 && (
                <div className="animate-fade-in">
                  <h2 className="form-title">{t("create_title")}</h2>
                  <p className="form-subtitle">{t("create_subtitle")}</p>

                  <div className="field-grid">
                    <label>
                      <span className="input-label">{t("create_name")} *</span>
                      <input className="text-input" maxLength={32} value={form.name}
                        onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. AckiDoge" />
                    </label>
                    <label>
                      <span className="input-label">{t("create_symbol")} *</span>
                      <input className="text-input" maxLength={10} value={form.symbol}
                        onChange={(e) => updateField("symbol", e.target.value)} placeholder="e.g. ADOGE" />
                    </label>
                  </div>

                  <div className="field-grid full">
                    <label>
                      <span className="input-label">{t("create_tagline")}</span>
                      <input className="text-input" value={form.tagline}
                        onChange={(e) => updateField("tagline", e.target.value)} placeholder="One line about your coin" />
                    </label>
                    <label>
                      <span className="input-label">{t("create_description")} * (min 20 chars)</span>
                      <textarea className="text-area" maxLength={280} value={form.description}
                        onChange={(e) => updateField("description", e.target.value)} placeholder="What's your coin about?" rows={3} />
                      <span className="input-hint" style={{ textAlign: 'right' }}>{form.description.length}/280</span>
                    </label>
                  </div>

                  <div className="card" style={{ background: 'var(--bg-deep)', padding: '16px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--accent)' }}>
                    <h3 className="input-label" style={{ marginTop: 0, marginBottom: '12px', color: 'var(--accent)' }}>Economic Model</h3>
                    <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input type="radio" name="pumpForever" checked={!form.pumpForever} onChange={() => updateField("pumpForever", false)} style={{ marginTop: '4px' }} />
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--ink)' }}>⚖️ Automatic Graduation (Classic)</div>
                          <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px' }}>Migrates to an internal AMM (x*y=k) automatically when it reaches 15K SHELL, stabilizing the price for community growth.</div>
                        </div>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input type="radio" name="pumpForever" checked={form.pumpForever} onChange={() => updateField("pumpForever", true)} style={{ marginTop: '4px' }} />
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--ink)' }}>🚀 Pump Forever (Infinite Curve)</div>
                          <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px' }}>Never graduates. The price continues to climb exponentially on the bonding curve forever. High risk, high volatility.</div>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-deep)', padding: '16px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--accent)' }}>
                    <h3 className="input-label" style={{ marginTop: 0, marginBottom: '12px', color: 'var(--accent)' }}>🚀 Pump Aggressiveness</h3>
                    <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '16px' }}>Choose how fast the price will climb on the bonding curve. Higher aggressiveness means higher risk and faster price action.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input 
                        type="range" 
                        min="1" max="5" step="1"
                        value={slopeDivisorToSlider(form.slopeDivisor)}
                        onChange={(e) => updateField("slopeDivisor", sliderToSlopeDivisor(Number(e.target.value)))}
                        style={{ width: '100%', accentColor: getSlopeLabel(form.slopeDivisor).color }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500' }}>
                        {[1, 2, 3, 4, 5].map(idx => (
                           <span key={idx} style={{ color: slopeDivisorToSlider(form.slopeDivisor) === idx ? getSlopeLabel(sliderToSlopeDivisor(idx)).color : 'var(--ink-soft)' }}>
                              {getSlopeLabel(sliderToSlopeDivisor(idx)).label.split(' ')[0]}
                           </span>
                        ))}
                      </div>
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--ink-soft)', borderLeft: `3px solid ${getSlopeLabel(form.slopeDivisor).color}` }}>
                        {form.slopeDivisor >= 20_000_000_000_000 && "🐢 Suave: Curva tranquila. O preço sobe 2x mais devagar, ideal para projetos que buscam estabilidade."}
                        {form.slopeDivisor >= 10_000_000_000_000 && form.slopeDivisor < 20_000_000_000_000 && "⚖️ Normal: O padrão clássico. Equilíbrio perfeito entre risco e recompensa, igual ao pump.fun."}
                        {form.slopeDivisor >= 5_000_000_000_000 && form.slopeDivisor < 10_000_000_000_000 && "⚡ Fast: Crescimento acelerado. O preço sobe 2x mais rápido, gerando FOMO imediato."}
                        {form.slopeDivisor >= 2_500_000_000_000 && form.slopeDivisor < 5_000_000_000_000 && "🔥 Aggressive: Alta voltagem. Movimentos rápidos que recompensam os primeiros compradores."}
                        {form.slopeDivisor < 2_500_000_000_000 && "💀 INSANE: Modo DeGen! O preço explode 10x mais rápido que o normal. Volatilidade extrema!"}
                      </div>
                    </div>
                  </div>

                  {/* Launch Boost */}
                  <div className="card" style={{ background: form.isBoosted ? 'rgba(255, 184, 0, 0.1)' : 'var(--bg-deep)', padding: '16px', marginBottom: '24px', borderRadius: '12px', border: form.isBoosted ? '1px solid #FFB800' : '1px solid var(--line-soft)', transition: 'all 0.2s ease' }}>
                    <h3 className="input-label" style={{ marginTop: 0, marginBottom: '12px', color: form.isBoosted ? '#FFB800' : 'var(--ink)' }}>🔥 Launch Boost</h3>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isBoosted} onChange={(e) => updateField("isBoosted", e.target.checked)} style={{ marginTop: '4px' }} />
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--ink)' }}>Fixar no Topo por 24h (+500 SHELL)</div>
                        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px' }}>Seu token aparecerá em destaque no topo do feed principal para atrair investidores mais rápido.</div>
                      </div>
                    </label>
                  </div>

                  <div className="field-grid">
                    <label>
                      <span className="input-label">{t("create_supply")}</span>
                      <input className="text-input" inputMode="numeric" value={form.totalSupply}
                        onChange={(e) => updateField("totalSupply", e.target.value)} />
                      <span className="input-hint">{formatNum(form.totalSupply)} tokens</span>
                    </label>
                    <label>
                      <span className="input-label">{t("create_logo")}</span>
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

                  <div className="card" style={{ background: form.isBoosted ? 'rgba(255, 184, 0, 0.1)' : 'var(--accent-glow)', borderColor: form.isBoosted ? '#FFB800' : 'var(--accent)', marginBottom: '24px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span className="info-label">{form.isBoosted ? "Creation Fee + Boost" : "Creation Fee"}</span>
                      <span className="info-value" style={{ color: form.isBoosted ? '#FFB800' : 'var(--accent)' }}>{requiredFee} {fee.tokenSymbol} {form.isBoosted ? '(Boosted)' : '(~$3 USD)'}</span>
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
                      1. Send <strong>{requiredFee} SHELL</strong> to the fee wallet above<br/>
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
                      <span className="info-value" style={{ fontSize: '14px' }}>{formatNum(form.totalSupply)}</span>
                    </div>
                  </div>

                  {launchStatus.error && <p className="error-msg" style={{ marginBottom: '20px' }}>{launchStatus.error}</p>}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="filter-btn" onClick={() => setStep(2)} style={{ padding: '12px 24px' }}>{t("detail_back")}</button>
                    <button className="btn-primary" disabled={launchStatus.loading} onClick={handleLaunch} style={{ flex: 1 }}>
                      {launchStatus.loading ? t("create_launching") : t("create_submit")}
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      </main>

      <style jsx>{`
        .animate-fade-in { animation: fadeInUp 0.4s ease both; }
        .error-msg { color: var(--red); }
      `}</style>
    </>
  );
}
