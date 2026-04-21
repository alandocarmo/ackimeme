import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { getLaunchById, getSession } from "../../lib/api";
import { BondingCurveAbi, TokenWalletAbi, TokenRootAbi } from "../../lib/abi";

function compactWallet(w) {
  const s = String(w || "");
  return s.length <= 14 ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatNum(n) {
  const v = Number(String(n || "0").replace(/[.,]/g, ""));
  return isNaN(v) ? n : v.toLocaleString("pt-BR");
}

function formatSupply(val) {
  const n = Number(String(val || "0").replace(/[.,]/g, ""));
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

/** Nano to decimal (9 decimals standard in TVM/SHELL) */
function nanoToDecimal(nano) {
  const val = BigInt(String(nano || "0").replace(/\D/g, "") || "0");
  const whole = val / 1_000_000_000n;
  const frac = val % 1_000_000_000n;
  return Number(`${whole}.${String(frac).padStart(9, "0")}`);
}

/** Helper to convert decimal string to BigInt nano (9 decimals) avoiding float imprecision */
function toNano(valStr) {
  if (!valStr || isNaN(parseFloat(valStr))) return 0n;
  const [whole = "0", frac = ""] = String(valStr).split(".");
  const fracPad = frac.padEnd(9, "0").slice(0, 9);
  return BigInt(whole) * 1_000_000_000n + BigInt(fracPad || "0");
}


const MIGRATION_THRESHOLD = 69000;

function readReserveBalance(onchainData) {
  const parsed = Number(onchainData?.reserveBalance);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function calcBondingStats(onchainData) {
  const reserveBalance = readReserveBalance(onchainData);
  const hasOnchainReserve = Number.isFinite(reserveBalance);
  const progressPct = hasOnchainReserve
    ? Math.min((reserveBalance / MIGRATION_THRESHOLD) * 100, 100).toFixed(1)
    : null;

  return { reserveBalance, hasOnchainReserve, progressPct };
}

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

export default function TokenPage() {
  const router = useRouter();
  const { id } = router.query;
  const [token, setToken] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tradeMode, setTradeMode] = useState("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [isTrading, setIsTrading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState("");
  const [onchainPrice, setOnchainPrice] = useState(null); // from getter

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then(r => setSession(r.session)).catch(() => {});
  }, []);

  const fetchToken = useCallback(() => {
    if (!id) return;
    getLaunchById(id)
      .then((data) => {
        setToken(data.launch);
        setError("");
      })
      .catch((err) => {
        if (String(err.message || "").toLowerCase().includes("404")) {
          setError("Token não encontrado.");
        } else {
          setError(err.message || "Falha ao carregar token.");
        }
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getLaunchById(id)
      .then((data) => {
        setToken(data.launch);
        setError("");
      })
      .catch((err) => {
        setToken(null);
        if (String(err.message || "").toLowerCase().includes("404")) {
          setError("Token não encontrado.");
          return;
        }
        setError(err.message || "Falha ao carregar token.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // FE-05: Polling every 15 seconds to keep data fresh
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(fetchToken, 15000);
    return () => clearInterval(interval);
  }, [id, fetchToken]);

  // Try reading current price from on-chain getter via provider
  useEffect(() => {
    if (!token?.onchainData?.bondingCurveAddress || token.onchainData.deployStatus !== "deployed") return;
    
    async function fetchPrice() {
      try {
        const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
        const ever = new ProviderRpcClient();
        if (!(await ever.hasProvider())) return;
        await ever.ensureInitialized();

        const bc = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress));
        const result = await bc.methods.currentPrice({}).call();
        if (result?.value0) {
          setOnchainPrice(nanoToDecimal(result.value0));
        }
      } catch {
        // Provider not available — use fallback
      }
    }
    fetchPrice();
  }, [token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus]);

  // M-06: Don't use misleading fallback price. If on-chain price isn't available,
  // show "awaiting" instead of a 33-million-times-wrong estimate.
  const currentPrice = onchainPrice;

  async function handleTrade() {
    if (!session) return router.push(`/auth?from=/token/${id}`);
    setError("");
    setIsTrading(true);
    
    try {
      if (!token?.onchainData?.bondingCurveAddress) {
        throw new Error("Contrato Bonding Curve não disponível. Aguarde o deploy on-chain.");
      }
      
      // Load the Provider Extension
      const { ProviderRpcClient, Address } = await import('everscale-inpage-provider');
      const ever = new ProviderRpcClient();
      if (!(await ever.hasProvider())) throw new Error("Instale a extensão Acki Nacki / EVER Wallet.");
      
      await ever.ensureInitialized();
      const { accountInteraction } = await ever.requestPermissions({ permissions: ['basic', 'accountInteraction'] });
      if (!accountInteraction) throw new Error("Conexão com a carteira negada.");

      const rawAmount = parseFloat(tradeAmount);
      if (!tradeAmount || rawAmount <= 0) throw new Error("Valor inválido.");

      const isBuy = tradeMode === "buy";
      const slippageMod = (100 - parseFloat(slippage)) / 100;

      if (isBuy) {
        // R-02: Send SHELL as Extra Currency cc[2], NOT as msg.value (VMSHELL)
        // The BondingCurve.buy() reads payment from msg.currencies[2].
        // msg.value (amount) is used ONLY for gas.
        if (!currentPrice) throw new Error("Preço ainda não disponível. Aguarde sync on-chain.");

        const shellToSpendNano = toNano(tradeAmount);
        const bcContract = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress));

        const expectedTokens = Math.floor(rawAmount / currentPrice);
        const slippagePct = parseFloat(slippage);
        
        // Calculate max SHELL I'm willing to spend (including slippage)
        const maxShellNano = shellToSpendNano * BigInt(Math.round(100 + slippagePct)) / 100n;

        const tx = await bcContract.methods.buy({
          tokenAmount: expectedTokens.toString(),
          maxShellIn: maxShellNano.toString()
        }).send({
          from: accountInteraction.address,
          amount: "200000000",  // 0.2 SHELL VMSHELL for gas only
          bounce: true,
          // SHELL payment via Extra Currency cc[2] (Acki Nacki Standard)
          currencies: { 2: maxShellNano.toString() }
        });
        setTradeSuccess(`Compra realizada com sucesso! Tx: ${tx.transaction.id.hash}`);
      } else {
        // SELL: Burn tokens via TokenWallet → TokenRoot.notifyBurn → BondingCurve.onTokenBurned
        if (!token?.onchainData?.tokenRootAddress) {
          throw new Error("TokenRoot não disponível. Impossível executar sell.");
        }

        // 1. Resolve user's TokenWallet address
        const rootContract = new ever.Contract(TokenRootAbi, new Address(token.onchainData.tokenRootAddress));
        const walletResult = await rootContract.methods.getWalletAddress({
          ownerAddress: accountInteraction.address
        }).call();
        
        const userWalletAddress = walletResult.value0;
        if (!userWalletAddress || userWalletAddress.toString() === "0:0000000000000000000000000000000000000000000000000000000000000000") {
          throw new Error("Você não possui uma TokenWallet para este token. Compre tokens primeiro.");
        }

        // 2. M-07: Verify user has enough balance for gas before attempting sell
        const state = await ever.getFullContractState({
          address: accountInteraction.address
        });
        const balanceNano = BigInt(state.state?.balance || "0");
        const gasNeeded = BigInt("500000000"); // 0.5 SHELL
        if (balanceNano < gasNeeded) {
          throw new Error(`Saldo insuficiente para gas. Precisa de pelo menos 0.5 SHELL na carteira. Saldo atual: ${Number(balanceNano) / 1e9} SHELL.`);
        }

        // 3. Call burn on user's TokenWallet, passing BondingCurve as callbackTarget
        const walletContract = new ever.Contract(TokenWalletAbi, new Address(userWalletAddress.toString()));
        
        const tokensToSellNano = toNano(tradeAmount);
        const tx = await walletContract.methods.burn({
          amount: tokensToSellNano.toString(),
          callbackTarget: token.onchainData.bondingCurveAddress
        }).send({
          from: accountInteraction.address,
          amount: "500000000", // 0.5 SHELL for processing gas
          bounce: true
        });
        setTradeSuccess(`Venda realizada com sucesso!`);
      }
      
    } catch(err) {
      setTradeSuccess("");
      setError(err.message || "Erro durante o trade.");
    } finally {
      setIsTrading(false);
    }
  }

  const stats = token ? calcBondingStats(token.onchainData) : null;
  const color = token ? hashColor(token.coin?.symbol) : "#888";
  const showMissingTokenCta = Boolean(error) && !loading && !token;

  // Estimate calculation using current price
  // M-06: When price isn't available, show clear indication instead of wrong values
  function getEstimate() {
    const amt = parseFloat(tradeAmount) || 0;
    if (amt <= 0) return "0";
    if (!currentPrice) return "aguardando preço...";
    if (tradeMode === "buy") {
      return formatNum(Math.floor(amt / currentPrice));
    }
    return (amt * currentPrice).toFixed(9);
  }

  return (
    <>
      <Head>
        <title>{token ? `$${token.coin.symbol} — ${token.coin.name}` : "Token"} | AckiMeme</title>
        <meta name="description" content={token?.coin?.tagline || "Memecoin on Acki Nacki"} />
      </Head>

      <main className="page-wrapper container" style={{ paddingTop: '40px' }}>
        {loading && <p className="token-time" style={{ textAlign: 'center', fontSize: '14px' }}>Loading token data...</p>}
        
        {showMissingTokenCta ? (
          <div className="card" style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', marginBottom: '16px' }}>{error}</p>
            <Link href="/" className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>Voltar para o feed</Link>
          </div>
        ) : error ? (
          <p style={{ color: 'var(--red)', textAlign: 'center', padding: '40px' }}>{error}</p>
        ) : null}

        {token && (
          <div className="token-detail-layout">
            {/* Left Column: Info */}
            <div className="detail-main">
              {/* Header */}
              <div className="token-header-section">
                <div className="token-avatar" style={{ width: '64px', height: '64px', borderRadius: '16px', background: `linear-gradient(135deg, ${color}, ${color}44)` }}>
                  {token.coin.logoUrl ? (
                    <img src={token.coin.logoUrl} alt="" />
                  ) : (
                    <span style={{ fontSize: '28px', fontWeight: 800 }}>{(token.coin.symbol || "?")[0]}</span>
                  )}
                </div>
                <div className="token-title-info">
                  <h1 className="token-main-title">{token.coin.name}</h1>
                  <span className="token-ticker">${token.coin.symbol}</span>
                </div>
                <div className="status-badge">{token.status.replace(/_/g, " ")}</div>
              </div>

              {/* Bonding Curve Card */}
              <div className="card" style={{ border: '1px solid var(--accent-glow)', background: 'rgba(0, 255, 136, 0.02)' }}>
                <div className="progress-header" style={{ marginBottom: '12px' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>⬡ Bonding Curve Progress</span>
                  <span className="token-time">Acki Nacki · Fair Launch</span>
                </div>
                
                <div className="progress-track" style={{ height: '12px', marginBottom: '20px' }}>
                  <div className="progress-fill" style={{
                    width: stats.progressPct === null ? "0%" : `${stats.progressPct}%`,
                    background: parseFloat(stats.progressPct || "0") > 80
                      ? "linear-gradient(90deg, #f97316, #ef4444)"
                      : "linear-gradient(90deg, #00ff88, #00cc6d)",
                  }} />
                </div>

                <div className="token-stats" style={{ borderTop: 'none', paddingTop: 0, marginBottom: '20px' }}>
                  <div className="stat-box">
                    <span className="stat-label">Progress</span>
                    <span className="stat-value" style={{ fontSize: '18px' }}>{stats.progressPct === null ? "N/A" : `${stats.progressPct}%`}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Reserve</span>
                    <span className="stat-value" style={{ fontSize: '18px' }}>{stats.hasOnchainReserve ? `${stats.reserveBalance.toFixed(2)} SHELL` : "awaiting"}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Threshold</span>
                    <span className="stat-value" style={{ fontSize: '18px' }}>69K SHELL</span>
                  </div>
                </div>
                
                <p className="token-subtitle" style={{ fontSize: '11px', margin: 0, opacity: 0.8 }}>
                  {stats.hasOnchainReserve
                    ? "Liquidity auto-migrates to DEX.DO at 69K SHELL reserve with 30-day anti-rug lock."
                    : "Progress requires reserveBalance indexed from blockchain. Values stay as awaiting until first trade."}
                </p>
              </div>

              {/* Deployment Status */}
              <div className="card" style={{ border: '1px dashed var(--ink-faint)' }}>
                 <p className="info-label">Blockchain Deployment Status</p>
                 <div className="onchain-info-grid">
                    <div className="onchain-item">
                       <p className="stat-label">Status</p>
                       <p className={`info-value ${token.onchainData?.deployStatus === 'deployed' ? 'hero-accent' : ''}`} style={{ fontSize: '13px' }}>
                          {token.onchainData?.deployStatus?.replace(/_/g, ' ') || 'unknown'}
                       </p>
                    </div>
                    <div className="onchain-item">
                       <p className="stat-label">Price</p>
                       <p className="info-value" style={{ fontSize: '13px' }}>
                          {onchainPrice ? `${onchainPrice.toFixed(9)} SHELL` : "awaiting sync"}
                       </p>
                    </div>
                 </div>
                 
                 {token.onchainData?.deployStatus === 'pending_deployer_configuration' && (
                    <p style={{ color: 'var(--accent-warm)', fontSize: '11px', marginTop: '12px' }}>
                      ⚠️ The system is waiting for the administrative deployer to be funded or configured. 
                      Trading functions are available after on-chain deployment is complete.
                    </p>
                 )}
              </div>

              {/* Info Grid */}
              <div className="info-card-grid">
                <div className="info-card">
                  <p className="info-label">Current Supply</p>
                  <p className="info-value">{formatSupply(token.onchainData?.tokenSupply || token.coin.totalSupply)}</p>
                </div>
                <div className="info-card">
                  <p className="info-label">Risk Profile</p>
                  <p className="info-value" style={{ color: token.riskProfile?.score > 70 ? 'var(--accent)' : 'var(--accent-warm)' }}>
                    {token.riskProfile?.score} / {token.riskProfile?.status}
                  </p>
                </div>
              </div>

              {/* About */}
              {token.coin.description && (
                <div className="card">
                  <p className="info-label">About {token.coin.name}</p>
                  <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>{token.coin.description}</p>
                </div>
              )}

              {/* On-chain Details */}
              <div className="card">
                <p className="info-label">On-Chain Identifiers</p>
                <div className="onchain-info-grid">
                  <div className="onchain-item">
                    <span className="stat-label">IPFS Metadata</span>
                    {token.onchainData?.ipfsHash ? (
                      <a href={`https://gateway.pinata.cloud/ipfs/${token.onchainData.ipfsHash}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {token.onchainData.ipfsHash.slice(0, 10)}...
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>Pending</span>}
                  </div>
                  <div className="onchain-item">
                    <span className="stat-label">Token Root</span>
                    {token.onchainData?.tokenRootAddress ? (
                      <a href={`https://ever.live/accounts/accountDetails?id=${encodeURIComponent(token.onchainData.tokenRootAddress)}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {compactWallet(token.onchainData.tokenRootAddress)}
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>Pending</span>}
                  </div>
                  <div className="onchain-item">
                    <span className="stat-label">Bonding Curve</span>
                    {token.onchainData?.bondingCurveAddress ? (
                      <a href={`https://ever.live/accounts/accountDetails?id=${encodeURIComponent(token.onchainData.bondingCurveAddress)}`} target="_blank" rel="noreferrer" className="onchain-link">
                        {compactWallet(token.onchainData.bondingCurveAddress)}
                      </a>
                    ) : <span className="token-time" style={{ display: 'block' }}>Pending</span>}
                  </div>
                </div>
              </div>

              {/* Links */}
              {(token.links?.website || token.links?.xUrl || token.links?.telegramUrl) && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {token.links.website && <a href={token.links.website} target="_blank" rel="noreferrer" className="filter-btn">🌐 Website</a>}
                  {token.links.xUrl && <a href={token.links.xUrl} target="_blank" rel="noreferrer" className="filter-btn">𝕏 Twitter</a>}
                  {token.links.telegramUrl && <a href={token.links.telegramUrl} target="_blank" rel="noreferrer" className="filter-btn">✈ Telegram</a>}
                </div>
              )}
            </div>

            {/* Right Column: Trade Widget */}
            <aside className="detail-sidebar">
              <div className="trade-widget">
                <div className="trade-tabs">
                  <button className={`trade-tab ${tradeMode === "buy" ? "active-buy" : ""}`} onClick={() => setTradeMode("buy")}>BUY</button>
                  <button className={`trade-tab ${tradeMode === "sell" ? "active-sell" : ""}`} onClick={() => setTradeMode("sell")}>SELL</button>
                </div>

                <div className="trade-panel">
                  <div className="trade-field-wrap">
                    <p className="info-label">Amount to {tradeMode}</p>
                    <div className="input-container">
                      <input type="number" placeholder="0.0" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} />
                      <span className="input-unit">{tradeMode === "buy" ? "SHELL" : token.coin.symbol}</span>
                    </div>
                  </div>

                  <div className="slippage-row">
                    <span className="info-label" style={{ fontSize: '9px' }}>Slippage</span>
                    <div className="slippage-btns">
                      {["1", "2", "5"].map(p => (
                        <button key={p} className={`slip-btn ${slippage === p ? "active" : ""}`} onClick={() => setSlippage(p)}>{p}%</button>
                      ))}
                    </div>
                  </div>

                  <div className="estimate-box">
                    <span className="estimate-label">Receive ≈</span>
                    <span className="estimate-val">
                      {getEstimate()} {tradeMode === "buy" ? token.coin.symbol : "SHELL"}
                    </span>
                  </div>

                  {onchainPrice && (
                    <p className="token-time" style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>
                      Current price: {onchainPrice.toFixed(9)} SHELL per token
                    </p>
                  )}

                  <button 
                    className={`trade-button ${tradeMode === 'buy' ? 'btn-buy' : 'btn-sell'}`}
                    onClick={handleTrade}
                    disabled={isTrading || token.onchainData?.deployStatus !== 'deployed'}
                  >
                    {isTrading 
                      ? "Processando Tx..." 
                      : token.onchainData?.deployStatus !== 'deployed'
                        ? "Aguardando deploy on-chain..."
                        : `Finalizar ${tradeMode.toUpperCase()}`
                    }
                  </button>
                  
                  {tradeSuccess && (
                    <p className="hero-accent" style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', fontWeight: 600 }}>
                      {tradeSuccess}
                    </p>
                  )}
                  
                  {tradeMode === "sell" && (
                    <p className="token-time" style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px' }}>
                      Sell burns your tokens via TokenWallet → BondingCurve refund.
                    </p>
                  )}

                  <a href="https://shellbuy.ackinax.com" target="_blank" rel="noreferrer"
                    className="filter-btn" style={{ display: 'block', textAlign: 'center', marginTop: '12px', fontSize: '11px' }}>
                    💎 Need SHELL? Buy with USDC →
                  </a>
                </div>
              </div>

              {!session && (
                <div className="card" style={{ marginTop: '16px', textAlign: 'center', padding: '16px' }}>
                  <p className="token-time" style={{ marginBottom: '12px' }}>Sign in to track your trades</p>
                  <Link href={`/auth?from=/token/${id}`} className="filter-btn" style={{ display: 'block' }}>Connect Wallet</Link>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
