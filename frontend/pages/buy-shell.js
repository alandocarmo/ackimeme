import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  getConfig,
  getMyShellBuyOrders,
  getSession,
  verifyShellBuyPayment,
} from "../lib/api";

function compactValue(value) {
  const str = String(value || "");
  if (str.length <= 18) return str;
  return `${str.slice(0, 12)}…${str.slice(-6)}`;
}

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

  const [session, setSession] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [orders, setOrders] = useState([]);

  const shellBuy = config?.shellBuy || {};

  async function loadOrders() {
    try {
      const response = await getMyShellBuyOrders();
      setOrders(response.orders || []);
    } catch {
      setOrders([]);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const [sessionRes, configRes] = await Promise.all([getSession(), getConfig()]);
        setSession(sessionRes.session || null);
        setConfig(configRes || null);
      } catch {
        setSession(null);
        try {
          const configRes = await getConfig();
          setConfig(configRes || null);
        } catch {
          setConfig(null);
        }
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadOrders();
  }, [session]);

  async function handleVerify() {
    if (!txHash.trim()) return;
    setVerifying(true);
    setVerifyError("");
    setVerifyMessage("");

    try {
      const response = await verifyShellBuyPayment({
        txHash: txHash.trim(),
      });

      const order = response.order;
      setVerifyMessage(
        `Pagamento confirmado: ${Number(order.usdcAmount).toFixed(6)} USDC → ${Number(order.shellAmount).toFixed(6)} SHELL`,
      );
      setTxHash("");
      await loadOrders();
    } catch (error) {
      setVerifyError(error.message || "Falha ao validar pagamento.");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <main className="page-wrapper container" style={{ paddingTop: "48px", textAlign: "center" }}>
        <p className="token-time">Loading SHELL purchase module...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <>
        <Head><title>Buy SHELL | AckiMeme</title></Head>
        <main className="auth-layout">
          <div className="auth-card" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "40px", marginBottom: "12px" }}>🔒</p>
            <h2 className="form-title">Connect wallet first</h2>
            <p className="form-subtitle">Você precisa autenticar a wallet para validar pagamento USDC.</p>
            <Link href={`/auth?from=${encodeURIComponent(`/buy-shell?from=${returnTo}`)}`} className="btn-primary" style={{ width: "100%" }}>
              Connect Wallet
            </Link>
            <Link href={returnTo} className="filter-btn" style={{ width: "100%", marginTop: "12px", display: "block", textAlign: "center" }}>
              ← Voltar
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!shellBuy?.enabled) {
    return (
      <>
        <Head><title>Buy SHELL | AckiMeme</title></Head>
        <main className="page-wrapper container" style={{ paddingTop: "48px" }}>
          <div className="card" style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center" }}>
            <h1 className="form-title" style={{ marginBottom: "12px" }}>SHELL Buy Unavailable</h1>
            <p className="form-subtitle">
              O módulo de compra USDC → SHELL ainda não está habilitado no backend.
            </p>
            <Link href={returnTo} className="btn-primary" style={{ marginTop: "20px", display: "inline-block" }}>
              Voltar
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Buy SHELL | AckiMeme</title>
        <meta
          name="description"
          content="Compre SHELL com USDC no próprio dApp e valide o pagamento on-chain."
        />
      </Head>

      <main className="page-wrapper container" style={{ paddingTop: "40px" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", display: "grid", gap: "20px" }}>
          <div className="card">
            <h1 className="form-title">Buy SHELL with USDC</h1>
            <p className="form-subtitle">
              Fluxo inspirado no Shell Buyer: verificação on-chain via TIP-3 + registro local do pedido.
            </p>

            <div className="field-grid">
              <div>
                <p className="input-label">Rate</p>
                <p className="info-value">{shellBuy.shellPerUsdc} SHELL / 1 USDC</p>
              </div>
              <div>
                <p className="input-label">Minimum</p>
                <p className="info-value">{shellBuy.minUsdcAmount} USDC</p>
              </div>
            </div>

            <label style={{ display: "block", marginTop: "12px" }}>
              <span className="input-label">USDC Recipient (Accumulator / Exchange)</span>
              <input
                className="text-input"
                value={shellBuy.usdcRecipient || ""}
                readOnly
                onFocus={(event) => event.target.select()}
              />
            </label>
            <p className="token-time" style={{ marginTop: "6px" }}>
              Envie USDC TIP-3 da sua wallet autenticada para esse endereço e depois valide o txHash abaixo.
            </p>
          </div>

          <div className="card">
            <h2 className="info-label" style={{ marginBottom: "10px" }}>Validate Payment</h2>
            <label>
              <span className="input-label">Transaction Hash</span>
              <input
                className="text-input"
                value={txHash}
                onChange={(event) => setTxHash(event.target.value)}
                placeholder="Cole o txHash do envio USDC TIP-3"
              />
            </label>

            {verifyMessage ? (
              <p className="hero-accent" style={{ marginTop: "12px" }}>{verifyMessage}</p>
            ) : null}
            {verifyError ? (
              <p className="error-msg" style={{ marginTop: "12px" }}>{verifyError}</p>
            ) : null}

            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button
                className={`btn-primary ${!txHash.trim() ? "trade-locked" : ""}`}
                style={{ flex: 1 }}
                onClick={handleVerify}
                disabled={!txHash.trim() || verifying}
              >
                {verifying ? "Validando..." : "Validar Pagamento"}
              </button>
              <Link href={returnTo} className="filter-btn" style={{ padding: "12px 18px" }}>
                Voltar
              </Link>
            </div>
          </div>

          <div className="card">
            <h2 className="info-label" style={{ marginBottom: "12px" }}>My Orders</h2>
            {orders.length === 0 ? (
              <p className="token-time">Nenhum pedido validado ainda.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {orders.map((order) => (
                  <div key={order.id} className="info-card" style={{ padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <span className="token-time">#{compactValue(order.id)}</span>
                      <span className="status-badge">{order.status}</span>
                    </div>
                    <p className="token-time" style={{ marginTop: "8px" }}>
                      tx: <code>{compactValue(order.txHash)}</code>
                    </p>
                    <p className="token-time">
                      {Number(order.usdcAmount).toFixed(6)} USDC → {Number(order.shellAmount).toFixed(6)} SHELL
                    </p>
                    <p className="token-time">
                      Verified: {order.onChainVerifiedAt ? new Date(order.onChainVerifiedAt).toLocaleString() : "pending"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
