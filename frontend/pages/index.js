import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import {
  createAuthChallenge,
  createLaunchRequest,
  getConfig,
  getMyLaunches,
  getMyLaunchpadSubmissions,
  getPublicLaunches,
  getPublicLaunchpadProjects,
  getSession,
  logout,
  submitLaunchpadTask,
  verifyAuthChallenge,
  verifyPayment,
} from "../lib/api";
import styles from "../styles/Home.module.css";

const SESSION_STORAGE_KEY = "ackimeme_session_token";
const FALLBACK_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "AckiMeme",
  network: process.env.NEXT_PUBLIC_NETWORK_LABEL || "Acki Nacki",
  payment: {
    feeWallet: "Configure backend/.env",
    creationFees: [
      { tokenSymbol: "SHELL", minimumAmount: 3 },
      { tokenSymbol: "USDC", minimumAmount: 10 },
    ],
    appFeeSharePercent: 100,
    networkSettlementToken: "VMSHELL",
  },
  auth: { challengeTtlSeconds: 300, telegramBindingRequired: false },
  launch: {
    mintingMode: "manual-review",
    symbolMaxLength: 10,
    nameMaxLength: 32,
    descriptionMaxLength: 280,
    distribution: { creatorPercent: 80, lockedReservePercent: 20 },
  },
  launchpad: {
    mode: "admin_curated_exclusive",
    submissionReview: "manual_review",
  },
};
const INITIAL_FORM = {
  name: "",
  symbol: "",
  tagline: "",
  description: "",
  totalSupply: "1000000000",
  logoUrl: "",
  website: "",
  xUrl: "",
  telegramUrl: "",
  creatorWallet: "",
  txHash: "",
  paymentTokenSymbol: "SHELL",
};
const INITIAL_AUTH_FORM = { walletAddress: "", publicKey: "", signature: "" };

function sanitizeSymbol(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}
function formatNumberString(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";
}
function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("pt-BR") : "";
}
function formatShortDate(value) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}
function truncateText(value, length = 120) {
  const text = String(value || "").trim();
  return text.length <= length ? text : `${text.slice(0, length).trim()}...`;
}
function compactWallet(value) {
  const text = String(value || "").trim();
  return text.length <= 14 ? text : `${text.slice(0, 6)}...${text.slice(-4)}`;
}
function getTelegramInitData() {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData || "";
}
function telegramGreeting(webApp) {
  const user = webApp?.initDataUnsafe?.user;
  if (user?.first_name) return `Sessão Telegram ativa para ${user.first_name}`;
  if (user?.username) return `Sessão Telegram ativa para @${user.username}`;
  return "Abra esta página pelo bot para usar como Telegram Mini App.";
}
function buildSubmissionMap(submissions) {
  const map = {};
  for (const submission of submissions) map[submission.taskId] = submission;
  return map;
}
function launchMatchesSearch(launch, query) {
  if (!query) return true;
  const haystack = [
    launch.coin?.name,
    launch.coin?.symbol,
    launch.coin?.tagline,
    launch.coin?.description,
    launch.creatorWallet,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function Home() {
  const [appConfig, setAppConfig] = useState(FALLBACK_CONFIG);
  const [form, setForm] = useState(INITIAL_FORM);
  const [authForm, setAuthForm] = useState(INITIAL_AUTH_FORM);
  const [challenge, setChallenge] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionToken, setSessionToken] = useState("");
  const [myLaunches, setMyLaunches] = useState([]);
  const [publicLaunches, setPublicLaunches] = useState([]);
  const [launchpadProjects, setLaunchpadProjects] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [taskProofs, setTaskProofs] = useState({});
  const [taskStates, setTaskStates] = useState({});
  const [feedSearch, setFeedSearch] = useState("");
  const [telegramMessage, setTelegramMessage] = useState(
    "Abra esta página pelo bot para usar como Telegram Mini App.",
  );
  const [authState, setAuthState] = useState({
    status: "idle",
    message: "Gere um challenge e valide a assinatura da wallet.",
  });
  const [paymentState, setPaymentState] = useState({
    status: "idle",
    message: "Escolha SHELL ou USDC e valide a transação.",
    payload: null,
  });
  const [launchState, setLaunchState] = useState({
    status: "idle",
    message: "Depois da fee validada, persista o launch request.",
    ticket: null,
  });
  const [configError, setConfigError] = useState("");
  const [launchesError, setLaunchesError] = useState("");
  const [publicFeedError, setPublicFeedError] = useState("");
  const [launchpadError, setLaunchpadError] = useState("");

  const deferredFeedSearch = useDeferredValue(feedSearch);
  const submissionMap = buildSubmissionMap(mySubmissions);
  const filteredPublicLaunches = publicLaunches.filter((launch) =>
    launchMatchesSearch(launch, deferredFeedSearch),
  );

  useEffect(() => {
    getConfig()
      .then((data) => {
        startTransition(() => {
          setAppConfig(data);
          setForm((current) => ({
            ...current,
            paymentTokenSymbol:
              data.payment.creationFees?.[0]?.tokenSymbol || current.paymentTokenSymbol,
          }));
        });
      })
      .catch((error) => setConfigError(error.message));

    getPublicLaunches()
      .then((response) => {
        setPublicLaunches(response.launches || []);
        setPublicFeedError("");
      })
      .catch((error) => setPublicFeedError(error.message));

    getPublicLaunchpadProjects()
      .then((response) => {
        setLaunchpadProjects(response.projects || []);
        setLaunchpadError("");
      })
      .catch((error) => setLaunchpadError(error.message));
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    webApp.ready();
    webApp.expand();
    setTelegramMessage(telegramGreeting(webApp));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedToken) return;
    getSession(storedToken)
      .then((response) => {
        setSessionToken(storedToken);
        setSession(response.session);
        setAuthForm((current) => ({
          ...current,
          walletAddress: response.session.walletAddress,
        }));
        setForm((current) => ({
          ...current,
          creatorWallet: response.session.walletAddress,
        }));
        loadMyLaunches(storedToken);
        loadMyLaunchpadSubmissions(storedToken);
      })
      .catch(() => window.localStorage.removeItem(SESSION_STORAGE_KEY));
  }, []);

  async function loadMyLaunches(token = sessionToken) {
    if (!token) return;
    try {
      const response = await getMyLaunches(token);
      setMyLaunches(response.launches || []);
      setLaunchesError("");
    } catch (error) {
      setLaunchesError(error.message);
    }
  }

  async function loadMyLaunchpadSubmissions(token = sessionToken) {
    if (!token) return;
    try {
      const response = await getMyLaunchpadSubmissions(token);
      setMySubmissions(response.submissions || []);
    } catch (error) {
      setLaunchpadError(error.message);
    }
  }

  function updateField(field, value) {
    const nextValue = field === "symbol" ? sanitizeSymbol(value) : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
    if (field === "txHash" || field === "paymentTokenSymbol") {
      setPaymentState({
        status: "idle",
        message: "Escolha SHELL ou USDC e valide a transação.",
        payload: null,
      });
    }
    setLaunchState({
      status: "idle",
      message: "Depois da fee validada, persista o launch request.",
      ticket: null,
    });
  }

  function updateAuthField(field, value) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  function updateTaskProof(taskId, value) {
    setTaskProofs((current) => ({ ...current, [taskId]: value }));
  }

  async function handleCreateChallenge() {
    setAuthState({ status: "loading", message: "Gerando challenge..." });
    try {
      const response = await createAuthChallenge({
        walletAddress: authForm.walletAddress,
        telegramInitData: getTelegramInitData(),
      });
      setChallenge(response.challenge);
      setForm((current) => ({ ...current, creatorWallet: authForm.walletAddress }));
      setAuthState({
        status: "pending",
        message: "Challenge gerado. Assine a mensagem e envie public key + signature.",
      });
    } catch (error) {
      setAuthState({ status: "error", message: error.message });
    }
  }

  async function handleVerifyWallet() {
    setAuthState({ status: "loading", message: "Validando assinatura..." });
    try {
      const response = await verifyAuthChallenge({
        challengeId: challenge?.id,
        walletAddress: authForm.walletAddress,
        publicKey: authForm.publicKey,
        signature: authForm.signature,
        telegramInitData: getTelegramInitData(),
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SESSION_STORAGE_KEY, response.session.token);
      }
      setSession(response.session);
      setSessionToken(response.session.token);
      setForm((current) => ({
        ...current,
        creatorWallet: response.session.walletAddress,
      }));
      setAuthState({ status: "success", message: "Wallet autenticada." });
      loadMyLaunches(response.session.token);
      loadMyLaunchpadSubmissions(response.session.token);
    } catch (error) {
      setAuthState({ status: "error", message: error.message });
    }
  }

  async function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    try {
      if (sessionToken) await logout(sessionToken);
    } catch (error) {
      // noop
    }
    setSession(null);
    setSessionToken("");
    setMyLaunches([]);
    setMySubmissions([]);
    setChallenge(null);
    setAuthForm(INITIAL_AUTH_FORM);
    setTaskProofs({});
    setTaskStates({});
  }

  async function handleVerifyPayment() {
    setPaymentState({
      status: "loading",
      message: "Consultando a transação na blockchain...",
      payload: null,
    });
    try {
      const response = await verifyPayment({
        walletAddress: session?.walletAddress,
        txHash: form.txHash,
        tokenSymbol: form.paymentTokenSymbol,
      });
      setPaymentState({
        status: "success",
        message: `Fee confirmada em ${formatDateTime(response.verifiedAt)}.`,
        payload: response.payment,
      });
    } catch (error) {
      setPaymentState({ status: "error", message: error.message, payload: null });
    }
  }

  async function handleLaunchRequest() {
    setLaunchState({ status: "loading", message: "Persistindo launch request...", ticket: null });
    try {
      const response = await createLaunchRequest(
        { ...form, creatorWallet: session?.walletAddress, symbol: sanitizeSymbol(form.symbol) },
        sessionToken,
      );
      setLaunchState({
        status: "success",
        message: "Launch request salvo com treasury e risk profile inicial.",
        ticket: response.launchRequest,
      });
      loadMyLaunches(sessionToken);
      getPublicLaunches().then((responseFeed) => setPublicLaunches(responseFeed.launches || []));
    } catch (error) {
      setLaunchState({ status: "error", message: error.message, ticket: null });
    }
  }

  async function handleTaskSubmit(projectId, taskId) {
    if (!sessionToken) return;
    setTaskStates((current) => ({
      ...current,
      [taskId]: { status: "loading", message: "Enviando prova..." },
    }));
    try {
      const response = await submitLaunchpadTask(
        projectId,
        taskId,
        { proofText: taskProofs[taskId] || "" },
        sessionToken,
      );
      setTaskStates((current) => ({
        ...current,
        [taskId]: { status: "success", message: "Tarefa enviada para revisão." },
      }));
      setTaskProofs((current) => ({ ...current, [taskId]: "" }));
      setMySubmissions((current) => {
        const nextItems = current.filter((item) => item.taskId !== response.submission.taskId);
        return [response.submission, ...nextItems];
      });
      getPublicLaunchpadProjects().then((responseProjects) =>
        setLaunchpadProjects(responseProjects.projects || []),
      );
    } catch (error) {
      setTaskStates((current) => ({
        ...current,
        [taskId]: { status: "error", message: error.message },
      }));
    }
  }

  const previewSymbol = sanitizeSymbol(form.symbol) || "ACKI";
  const previewName = form.name.trim() || "Seu token";
  const previewTagline =
    form.tagline.trim() || "Coin pública publicada no board geral do app.";
  const selectedFee =
    appConfig.payment.creationFees.find((fee) => fee.tokenSymbol === form.paymentTokenSymbol) ||
    appConfig.payment.creationFees[0];
  const canVerifyWallet =
    Boolean(challenge?.id) &&
    Boolean(authForm.walletAddress.trim()) &&
    Boolean(authForm.publicKey.trim()) &&
    Boolean(authForm.signature.trim());
  const canVerifyFee =
    Boolean(session?.walletAddress) && Boolean(form.paymentTokenSymbol) && Boolean(form.txHash.trim());
  const canCreateLaunch =
    Boolean(session?.walletAddress) &&
    Boolean(form.name.trim()) &&
    Boolean(previewSymbol) &&
    Boolean(form.description.trim()) &&
    Boolean(form.totalSupply.trim()) &&
    Boolean(form.txHash.trim());

  return (
    <>
      <Head>
        <title>{appConfig.appName}</title>
        <meta name="description" content="Feed público geral + launchpad exclusivo curado." />
      </Head>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <main className={styles.shell}>
        <div className={`${styles.orb} ${styles.orbPrimary}`} />
        <div className={`${styles.orb} ${styles.orbWarm}`} />
        <section className={styles.heroBlank}>
          <div className={styles.terminalHeader}>
             <p className={styles.eyebrow}>{telegramMessage}</p>
             <Link href="#launch-form" className={styles.launchCta}>
                [ start a new coin ]
             </Link>
             <div className={styles.terminalNav}>
                <Link href="#market-feed" className={styles.terminalLink}>/board</Link>
                <Link href="/exclusive" className={styles.terminalLink}>/launchpad-exclusivo</Link>
                <Link href="/admin" className={styles.terminalLink}>/admin</Link>
             </div>
          </div>
        </section>
        <section className={styles.marketStrip} id="market-feed">
          <div className={styles.marketHeader}>
            <div>
              <p className={styles.eyebrow}>Feed público geral</p>
              <h2 className={styles.marketTitle}>Board aberto estilo market feed</h2>
              <p className={styles.marketIntro}>
                Aqui entram os launches públicos. O launchpad exclusivo não se mistura
                com esta fila.
              </p>
            </div>
            <div className={styles.marketControls}>
              <input
                className={styles.marketSearch}
                onChange={(event) => setFeedSearch(event.target.value)}
                placeholder="Buscar por nome, ticker ou wallet"
                value={feedSearch}
              />
              <div className={styles.marketCounter}>
                {filteredPublicLaunches.length} listados
              </div>
            </div>
          </div>

          <div className={styles.marketTicker}>
            <span>public feed</span>
            <span>anyone can submit</span>
            <span>fair launch (bonding curve)</span>
            <span>fee: $3 USDC</span>
          </div>

          {publicFeedError ? (
            <p className={styles.smallPrint}>{publicFeedError}</p>
          ) : filteredPublicLaunches.length === 0 ? (
            <p className={styles.smallPrint}>
              Ainda não há launches públicos persistidos no backend.
            </p>
          ) : (
            <div className={styles.marketGrid}>
              {filteredPublicLaunches.map((launch) => (
                <article className={styles.marketCard} key={launch.id}>
                  <div className={styles.marketCardTop}>
                    <span className={styles.marketBadge}>public</span>
                    <span className={styles.marketTime}>
                      {formatShortDate(launch.createdAt)}
                    </span>
                  </div>
                  <div className={styles.marketIdentity}>
                    <div className={styles.marketToken}>{launch.coin.symbol}</div>
                    <div className={styles.marketMeta}>
                      <p className={styles.marketName}>{launch.coin.name}</p>
                      <p className={styles.marketSub}>{compactWallet(launch.creatorWallet)}</p>
                    </div>
                  </div>
                  <p className={styles.marketDescription}>
                    {truncateText(launch.coin.tagline || launch.coin.description, 120)}
                  </p>
                  <div className={styles.marketStats}>
                    <div>
                      <p className={styles.marketStatLabel}>Fee</p>
                      <p className={styles.marketStatValue}>
                        {launch.treasuryPayment.amount} {launch.treasuryPayment.tokenSymbol}
                      </p>
                    </div>
                    <div>
                      <p className={styles.marketStatLabel}>Risk</p>
                      <p className={styles.marketStatValue}>
                        {launch.riskProfile.status} / {launch.riskProfile.score}
                      </p>
                    </div>
                    <div>
                      <p className={styles.marketStatLabel}>Supply</p>
                      <p className={styles.marketStatValue}>
                        {formatNumberString(launch.coin.totalSupply)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.marketStatLabel}>Mode</p>
                      <p className={styles.marketStatValue}>
                        Bonding Curve
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Launchpad Removido */}

        <section className={styles.workspace} id="launch-form">
          <div className={styles.formColumn}>
            {/* Wallet auth was moved to /auth */}
            {session ? (
              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Wallet conectada</h2>
                    <p className={styles.sectionBody}>
                      {session.walletAddress.slice(0,8)}...{session.walletAddress.slice(-6)}
                    </p>
                  </div>
                  <button className={styles.actionButtonMuted} onClick={handleLogout} type="button">
                    Desconectar
                  </button>
                </div>
              </section>
            ) : (
              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Conecte sua wallet</h2>
                    <p className={styles.sectionBody}>
                      Autentique com sua wallet Acki Nacki para criar tokens no board.
                    </p>
                  </div>
                </div>
                <div className={styles.actionRow}>
                  <Link className={styles.actionButton} href="/auth">
                    [ connect wallet ]
                  </Link>
                </div>
              </section>
            )}

            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Token setup</h2>
                  <p className={styles.sectionBody}>
                    Este fluxo é do feed público geral. O launchpad exclusivo é
                    operado pelo admin.
                  </p>
                </div>
                <span className={styles.sectionTag}>Passo 1</span>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Nome do token</span>
                  <input
                    className={styles.field}
                    maxLength={appConfig.launch.nameMaxLength}
                    onChange={(event) => updateField("name", event.target.value)}
                    value={form.name}
                  />
                </label>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Ticker</span>
                  <input
                    className={styles.field}
                    maxLength={appConfig.launch.symbolMaxLength}
                    onChange={(event) => updateField("symbol", event.target.value)}
                    value={form.symbol}
                  />
                </label>
                <label className={styles.fieldWrapWide}>
                  <span className={styles.label}>Tagline</span>
                  <input
                    className={styles.field}
                    onChange={(event) => updateField("tagline", event.target.value)}
                    value={form.tagline}
                  />
                </label>
                <label className={styles.fieldWrapWide}>
                  <span className={styles.label}>Descrição</span>
                  <textarea
                    className={styles.area}
                    maxLength={appConfig.launch.descriptionMaxLength}
                    onChange={(event) => updateField("description", event.target.value)}
                    value={form.description}
                  />
                </label>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Supply total</span>
                  <input
                    className={styles.field}
                    inputMode="numeric"
                    onChange={(event) => updateField("totalSupply", event.target.value)}
                    value={form.totalSupply}
                  />
                </label>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Logo URL</span>
                  <input
                    className={styles.field}
                    onChange={(event) => updateField("logoUrl", event.target.value)}
                    value={form.logoUrl}
                  />
                </label>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Website</span>
                  <input
                    className={styles.field}
                    onChange={(event) => updateField("website", event.target.value)}
                    value={form.website}
                  />
                </label>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>X</span>
                  <input
                    className={styles.field}
                    onChange={(event) => updateField("xUrl", event.target.value)}
                    value={form.xUrl}
                  />
                </label>
                <label className={styles.fieldWrapWide}>
                  <span className={styles.label}>Telegram</span>
                  <input
                    className={styles.field}
                    onChange={(event) => updateField("telegramUrl", event.target.value)}
                    value={form.telegramUrl}
                  />
                </label>
              </div>
            </section>

            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Fee e publish no feed</h2>
                  <p className={styles.sectionBody}>
                    Taxa do app: $3 USDC por token criado. Gas on-chain pago pelo criador.
                  </p>
                </div>
                <span className={styles.sectionTag}>Passo 2</span>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Wallet autenticada</span>
                  <input
                    className={`${styles.field} ${styles.mono}`}
                    readOnly
                    value={session?.walletAddress || ""}
                  />
                </label>
                <label className={styles.fieldWrap}>
                  <span className={styles.label}>Token da taxa</span>
                  <select
                    className={styles.field}
                    onChange={(event) => updateField("paymentTokenSymbol", event.target.value)}
                    value={form.paymentTokenSymbol}
                  >
                    {appConfig.payment.creationFees.map((fee) => (
                      <option key={fee.tokenSymbol} value={fee.tokenSymbol}>
                        {fee.tokenSymbol} - {fee.minimumAmount}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldWrapWide}>
                  <span className={styles.label}>Tx hash</span>
                  <input
                    className={`${styles.field} ${styles.mono}`}
                    onChange={(event) => updateField("txHash", event.target.value)}
                    value={form.txHash}
                  />
                </label>
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.actionButton}
                  disabled={!canVerifyFee}
                  onClick={handleVerifyPayment}
                  type="button"
                >
                  Verificar fee
                </button>
                <button
                  className={styles.actionButtonMuted}
                  disabled={!canCreateLaunch}
                  onClick={handleLaunchRequest}
                  type="button"
                >
                  Publicar no feed
                </button>
              </div>
            </section>
          </div>
          <aside className={styles.sideColumn}>
            <section className={styles.sidePanel}>
              <h2 className={styles.panelTitle}>Sessão atual</h2>
              <p className={styles.panelCopy}>
                O mesmo login por wallet serve para criar coins no feed público e
                para enviar provas no launchpad exclusivo.
              </p>
              {session ? (
                <div className={styles.sessionMeta}>
                  <div className={styles.sessionMetaRow}>
                    <p className={styles.sessionMetaLabel}>Wallet</p>
                    <p className={`${styles.sessionMetaValue} ${styles.mono}`}>
                      {session.walletAddress}
                    </p>
                  </div>
                  <div className={styles.sessionMetaRow}>
                    <p className={styles.sessionMetaLabel}>Proof level</p>
                    <p className={styles.sessionMetaValue}>{session.proofLevel}</p>
                  </div>
                  <div className={styles.sessionMetaRow}>
                    <p className={styles.sessionMetaLabel}>Telegram binding</p>
                    <p className={styles.sessionMetaValue}>
                      {session.telegramBinding.status}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={styles.smallPrint}>
                  Sem sessão autenticada a API não aceita publish no feed nem
                  submission de tarefa.
                </p>
              )}
            </section>

            <section className={styles.sidePanel}>
              <h2 className={styles.panelTitle}>Configuração</h2>
              <p className={styles.panelCopy}>
                Fee wallet, taxa do app e distribuição inicial modeladas no backend.
              </p>
              <p className={`${styles.address} ${styles.mono}`}>
                {appConfig.payment.feeWallet}
              </p>
              <div className={styles.metaList}>
                <div>
                  <p className={styles.metaLabel}>Fee app</p>
                  <p className={styles.metaValue}>{appConfig.payment.appFeeSharePercent}%</p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Settlement</p>
                  <p className={styles.metaValue}>
                    {appConfig.payment.networkSettlementToken}
                  </p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Distribuição</p>
                  <p className={styles.metaValue}>
                    {appConfig.launch.distribution.creatorPercent}% /
                    {appConfig.launch.distribution.lockedReservePercent}%
                  </p>
                </div>
              </div>
              {configError ? <p className={styles.smallPrint}>{configError}</p> : null}
            </section>

            <section className={styles.sidePanel}>
              <h2 className={styles.panelTitle}>Status</h2>
              <div className={styles.statusStack}>
                <div
                  className={`${styles.statusBlock} ${
                    paymentState.status === "success"
                      ? styles.success
                      : paymentState.status === "error"
                        ? styles.error
                        : ""
                  }`}
                >
                  <p className={styles.statusLabel}>Verificação da fee</p>
                  <p className={styles.statusValue}>{paymentState.message}</p>
                </div>
                <div
                  className={`${styles.statusBlock} ${
                    launchState.status === "success"
                      ? styles.success
                      : launchState.status === "error"
                        ? styles.error
                        : ""
                  }`}
                >
                  <p className={styles.statusLabel}>Publish no feed</p>
                  <p className={styles.statusValue}>{launchState.message}</p>
                </div>
              </div>
              {paymentState.payload ? (
                <div className={styles.callout}>
                  <p className={styles.calloutTitle}>Treasury settlement</p>
                  <p className={styles.calloutBody}>
                    {paymentState.payload.networkSettlementStatus}
                  </p>
                </div>
              ) : null}
              {launchState.ticket ? (
                <div className={styles.ticket}>
                  <p className={styles.ticketId}>Launch ID</p>
                  <p className={`${styles.ticketValue} ${styles.mono}`}>
                    {launchState.ticket.id}
                  </p>
                </div>
              ) : null}
            </section>

            <section className={styles.sidePanel}>
              <h2 className={styles.panelTitle}>Minha atividade</h2>
              <div className={styles.miniSummary}>
                <div>
                  <p className={styles.metaLabel}>Feed publishes</p>
                  <p className={styles.metaValue}>{myLaunches.length}</p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Task submissions</p>
                  <p className={styles.metaValue}>{mySubmissions.length}</p>
                </div>
              </div>
              {launchesError ? (
                <p className={styles.smallPrint}>{launchesError}</p>
              ) : myLaunches.length === 0 ? (
                <p className={styles.smallPrint}>Nenhum launch persistido para esta wallet.</p>
              ) : (
                <div className={styles.launchList}>
                  {myLaunches.slice(0, 4).map((launch) => (
                    <div className={styles.launchCard} key={launch.id}>
                      <p className={styles.launchCardTitle}>
                        {launch.launchRequest.coin.name} ({launch.launchRequest.coin.symbol})
                      </p>
                      <p className={styles.launchCardBody}>{launch.status}</p>
                      <p className={styles.launchCardMeta}>
                        Fee: {launch.treasuryPayment.amount} {launch.treasuryPayment.tokenSymbol}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.sidePanel}>
              <h2 className={styles.panelTitle}>Operação</h2>
              <p className={styles.panelCopy}>
                O admin opera o launchpad exclusivo em uma área separada do board
                geral.
              </p>
              <Link className={styles.secondaryLink} href="/admin">
                Abrir admin
              </Link>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}
