import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { formatNum as formatNumber } from "../lib/utils";

// Official Acki Nacki Shell Buyer — supports card (Stripe) and crypto (NOWPayments)
const SHELL_BUYER_URL = "https://shellbuy.ackinax.com/";

function sanitizeReturnTo(url) {
  if (!url || typeof url !== "string") return "/";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return "/";
  }
  return url.startsWith("/") ? url : "/";
}

export default function BuyShellPage() {
  const router = useRouter();
  const returnTo = useMemo(() => sanitizeReturnTo(router.query.from), [router.query.from]);

  return (
    <>
      <Head>
        <title>Buy SHELL | AckiMeme</title>
        <meta
          name="description"
          content="Buy SHELL tokens with credit card, debit card, or cryptocurrency to trade memecoins on AckiMeme."
        />
      </Head>

      <main className="page-wrapper container" style={{ paddingTop: "40px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", display: "grid", gap: "20px" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚡</div>
            <h1 className="form-title">Buy SHELL</h1>
            <p className="form-subtitle" style={{ marginBottom: "24px" }}>
              SHELL is the native token used for trading memecoins on AckiMeme.
              Choose your preferred method below.
            </p>

            {/* Option 1: Official Shell Buyer */}
            <div className="card" style={{ background: "var(--bg-panel)", border: "1px solid var(--line-soft)", marginBottom: "16px", padding: "20px", textAlign: "left" }}>
              <h2 className="info-label" style={{ color: "var(--ink)", marginBottom: "12px", fontSize: "14px" }}>
                💳 Buy SHELL with Card or Crypto (No Platform Fee)
              </h2>
              <p style={{ color: "var(--ink-soft)", fontSize: "13px", lineHeight: "1.6", marginBottom: "16px" }}>
                Use the official <b>Acki Nacki Shell Buyer</b> to purchase SHELL with:
              </p>
              <div className="field-grid" style={{ marginBottom: "16px" }}>
                <div>
                  <p className="input-label">💳 Card</p>
                  <p className="info-value" style={{ fontSize: "13px" }}>Visa, MasterCard via Stripe</p>
                </div>
                <div>
                  <p className="input-label">🪙 Crypto</p>
                  <p className="info-value" style={{ fontSize: "13px" }}>USDC, USDT (Arbitrum, ETH, BSC, Polygon, Optimism, Tron)</p>
                </div>
              </div>
              <a
                href={SHELL_BUYER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ width: "100%", display: "block", textAlign: "center", padding: "14px", background: "var(--bg-deep)", color: "var(--ink)" }}
              >
                Open Official Buyer ↗
              </a>
            </div>

            {/* Option 2: Native Swap */}
            <SwapPanel />

            {/* Info box */}
            <div style={{ textAlign: "left", padding: "12px 16px", background: "var(--bg-deep)", borderRadius: "var(--radius)", marginBottom: "24px" }}>
              <p style={{ color: "var(--ink-soft)", fontSize: "11px", lineHeight: "1.6", margin: 0 }}>
                <strong style={{ color: "var(--ink)" }}>ℹ️ Accumulator Rate:</strong> The base rate is <b>100 SHELL = 1 USDC</b>.
              </p>
            </div>

            <Link href={returnTo} className="filter-btn" style={{ width: "100%", display: "block", textAlign: "center", padding: "14px" }}>
              ← Back
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function SwapPanel() {
  const [amount, setAmount] = useState('');
  const parsedAmount = parseFloat(amount) || 0;
  const feeAmount = parsedAmount * 0.01;
  const shellOut = (parsedAmount - feeAmount) * 100;

  async function handleSwap() {
    alert('USDC Wallet integration is required. Please check your extension.');
  }

  return (
    <div className="card" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line-soft)', marginBottom: '16px', padding: '20px', textAlign: 'left' }}>
      <h2 className="info-label" style={{ color: 'var(--ink)', marginBottom: '12px', fontSize: '14px' }}>
        🪙 Swap USDC to SHELL (1% Platform Fee)
      </h2>
      <p style={{ color: 'var(--ink-soft)', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
        Already have Acki Nacki USDC? Swap it directly for SHELL through our native router.
      </p>
      
      <div className="input-group" style={{ marginBottom: '16px' }}>
        <label className="input-label">Amount (USDC)</label>
        <input type="number" placeholder="100" className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      
      <div style={{ background: 'var(--bg-deep)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--ink-soft)' }}>Exchange Rate:</span>
          <span style={{ color: 'var(--ink)' }}>1 USDC = 100 SHELL</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--ink-soft)' }}>Platform Fee (1%):</span>
          <span style={{ color: 'var(--ink)' }}>{formatNumber(feeAmount)} USDC</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span style={{ color: 'var(--ink-soft)' }}>You Receive:</span>
          <span style={{ color: 'var(--accent)' }}>{formatNumber(shellOut)} SHELL</span>
        </div>
      </div>

      <button
        className="btn-primary"
        style={{ width: '100%', display: 'block', textAlign: 'center', padding: '14px' }}
        onClick={handleSwap}
        disabled={!parsedAmount || parsedAmount <= 0}
      >
        Swap USDC to SHELL
      </button>
    </div>
  );
}

