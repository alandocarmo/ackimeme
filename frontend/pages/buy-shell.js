import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

// Placeholder for the Acki Nacki Accumulator Address.
// Must be configured in production via .env.local
const ACCUMULATOR_ADDRESS = process.env.NEXT_PUBLIC_ACCUMULATOR_ADDRESS || "0:0000000000000000000000000000000000000000000000000000000000000000";

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
          content="Compre SHELL com USDC instantaneamente via Accumulator Contract on-chain."
        />
      </Head>

      <main className="page-wrapper container" style={{ paddingTop: "40px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", display: "grid", gap: "20px" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚡</div>
            <h1 className="form-title">Buy SHELL Instantly</h1>
            <p className="form-subtitle" style={{ marginBottom: "24px" }}>
              A troca de USDC por SHELL agora é 100% descentralizada via <b>Accumulator Smart Contract</b> na Acki Nacki.
            </p>

            <div className="field-grid" style={{ textAlign: "left", marginBottom: "24px" }}>
              <div>
                <p className="input-label">Fixed Rate</p>
                <p className="info-value" style={{ color: "var(--accent)" }}>100 SHELL = 1 USDC</p>
              </div>
              <div>
                <p className="input-label">Settlement</p>
                <p className="info-value">Instant On-Chain</p>
              </div>
            </div>

            <div style={{ textAlign: "left", padding: "16px", background: "var(--bg-panel)", borderRadius: "var(--radius)", border: "1px solid var(--line-soft)", marginBottom: "24px" }}>
              <h2 className="info-label" style={{ marginBottom: "12px", color: "var(--ink)" }}>How to buy:</h2>
              <ol style={{ paddingLeft: "20px", color: "var(--ink-soft)", fontSize: "14px", lineHeight: "1.6" }}>
                <li>Abra sua carteira Acki Nacki (extensão ou mobile).</li>
                <li>Selecione o token <b>USDC (ID: 3)</b>.</li>
                <li>Envie qualquer valor para o endereço do Accumulator abaixo.</li>
                <li>O contrato inteligente enviará os tokens <b>SHELL (ID: 2)</b> diretamente para a sua carteira de forma automática.</li>
              </ol>
            </div>

            <label style={{ display: "block", textAlign: "left", marginBottom: "24px" }}>
              <span className="input-label">Accumulator Address</span>
              <input
                className="text-input"
                value={ACCUMULATOR_ADDRESS}
                readOnly
                onFocus={(event) => event.target.select()}
                style={{ fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center" }}
              />
              {ACCUMULATOR_ADDRESS.startsWith("0:00000") && (
                <p className="error-msg" style={{ marginTop: "8px", fontSize: "12px", textAlign: "center" }}>
                  ⚠️ Endereço não configurado. Adicione NEXT_PUBLIC_ACCUMULATOR_ADDRESS no painel da Vercel.
                </p>
              )}
            </label>

            <Link href={returnTo} className="btn-primary" style={{ width: "100%", padding: "14px" }}>
              ← Voltar
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
