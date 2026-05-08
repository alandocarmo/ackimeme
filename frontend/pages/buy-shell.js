import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

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
              You can buy it instantly with a card or cryptocurrency.
            </p>

            {/* Option 1: Official Shell Buyer */}
            <div className="card" style={{ background: "var(--accent-glow)", borderColor: "var(--accent)", marginBottom: "16px", padding: "20px", textAlign: "left" }}>
              <h2 className="info-label" style={{ color: "var(--accent)", marginBottom: "12px", fontSize: "14px" }}>
                💳 Buy with Card or Crypto (Recommended)
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
                style={{ width: "100%", display: "block", textAlign: "center", padding: "14px" }}
              >
                Open Shell Buyer →
              </a>
            </div>

            {/* Option 2: How it works */}
            <div style={{ textAlign: "left", padding: "16px", background: "var(--bg-panel)", borderRadius: "var(--radius)", border: "1px solid var(--line-soft)", marginBottom: "16px" }}>
              <h2 className="info-label" style={{ marginBottom: "12px", color: "var(--ink)" }}>How it works:</h2>
              <ol style={{ paddingLeft: "20px", color: "var(--ink-soft)", fontSize: "13px", lineHeight: "1.8" }}>
                <li>Connect your <b>Acki Nacki Wallet</b> via QR code</li>
                <li>Choose a SHELL package and your payment method</li>
                <li>Pay with card (Stripe) or crypto (NOWPayments)</li>
                <li>SHELL tokens are minted and delivered directly to your wallet</li>
              </ol>
            </div>

            {/* Info box */}
            <div style={{ textAlign: "left", padding: "12px 16px", background: "var(--bg-deep)", borderRadius: "var(--radius)", marginBottom: "24px" }}>
              <p style={{ color: "var(--ink-soft)", fontSize: "11px", lineHeight: "1.6", margin: 0 }}>
                <strong style={{ color: "var(--ink)" }}>ℹ️ Exchange Rate:</strong> The official rate is <b>100 SHELL = 1 USDC</b> (fixed on-chain via Accumulator Contract).
                Card payments may include processing fees from Stripe depending on your country.
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
