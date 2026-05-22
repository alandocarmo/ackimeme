import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState, useEffect } from "react";
import { formatNum as formatNumber, toNano } from "../lib/utils";
import { getConfig } from "../lib/api";
import { TokenRootAbi, TokenWalletAbi } from "../lib/abi";
import type { AppConfig } from "../types";

// Official Acki Nacki Shell Buyer — supports card (Stripe) and crypto (NOWPayments)
const SHELL_BUYER_URL = "https://shellbuy.ackinax.com/";

function sanitizeReturnTo(url: string | string[] | undefined): string {
  if (!url || typeof url !== "string") return "/";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return "/";
  }
  return url.startsWith("/") ? url : "/";
}

export default function BuyShellPage() {
  const router = useRouter();
  const returnTo = useMemo(() => sanitizeReturnTo(router.query.from as string | undefined), [router.query.from]);

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


function SwapPanel(): React.JSX.Element {
  const [amount, setAmount] = useState<string>('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  useEffect(() => {
    getConfig().then(c => setConfig(c)).catch(() => {});
  }, []);

  const parsedAmount = parseFloat(amount) || 0;
  const feeAmount = parsedAmount * 0.01;
  const shellOut = (parsedAmount - feeAmount) * 100;

  async function handleSwap(): Promise<void> {
    if (!config || !config.shellBuy || !config.shellBuy.enabled) {
      setError("Swap de USDC não está habilitado na rede.");
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { getEver } = await import('../lib/ever');
      const ever = await getEver();
      const { Address } = await import('everscale-inpage-provider');
      const { accountInteraction } = await ever.requestPermissions({ permissions: ['basic', 'accountInteraction'] });
      if (!accountInteraction) throw new Error("Conexão com a carteira negada.");

      const rootContract = new ever.Contract(TokenRootAbi, new Address(config.shellBuy.usdcRoot));
      const walletResult = await (rootContract.methods as any).getWalletAddress({
        ownerAddress: accountInteraction.address,
        answerId: 0
      }).call();
      
      const userWalletAddress = walletResult.value0;
      if (!userWalletAddress || userWalletAddress.toString() === "0:0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("Você não possui carteira USDC ou o saldo é nulo.");
      }

      const balance = await ever.getBalance(accountInteraction.address);
      if (BigInt(balance || "0") < 500000000n) {
         throw new Error("Saldo de SHELL insuficiente para o gas da transação.");
      }

      const walletContract = new ever.Contract(TokenWalletAbi, new Address(userWalletAddress.toString()));
      
      const tokensToSellNano = toNano(amount);

      const tx = await (walletContract.methods as any).transfer({
        recipientOwner: config.shellBuy.usdcRecipient,
        amount: tokensToSellNano.toString(),
      }).send({
        from: accountInteraction.address,
        amount: "500000000",
        bounce: true
      });
      
      setSuccess(`Swap iniciado com sucesso! Tx: ${(tx as any)?.transaction?.id?.hash?.slice(0, 8) || 'confirmada'}`);
      setAmount('');
    } catch(err: any) {
      setError(err.message || "Falha no swap.");
    } finally {
      setLoading(false);
    }
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
        <input type="number" placeholder="100" className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} />
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

      {error && <p style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '12px' }}>{error}</p>}
      {success && <p style={{ color: 'var(--accent)', fontSize: '12px', marginBottom: '12px', fontWeight: 'bold' }}>{success}</p>}

      <button
        className="btn-primary"
        style={{ width: '100%', display: 'block', textAlign: 'center', padding: '14px' }}
        onClick={handleSwap}
        disabled={!parsedAmount || parsedAmount <= 0 || loading}
      >
        {loading ? 'Processing...' : 'Swap USDC to SHELL'}
      </button>
    </div>
  );
}

