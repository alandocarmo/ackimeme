import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/router";
import { startTransition, useEffect, useState } from "react";
import {
  getConfig,
  getPublicLaunchpadProject,
  getSession,
  submitLaunchpadTask,
} from "../../lib/api";
import shared from "../../styles/Home.module.css";
import styles from "../../styles/LaunchpadDetail.module.css";

const SESSION_STORAGE_KEY = "ackimeme_session_token";
const FALLBACK_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "AckiMeme",
  launchpad: {
    mode: "admin_curated_exclusive",
    submissionReview: "manual_review",
  },
};
const EMPTY_VIEWER = {
  authenticated: false,
  walletAddress: "",
  submissions: [],
  submissionSummary: {
    total: 0,
    approved: 0,
    rejected: 0,
    underReview: 0,
    submitted: 0,
    completionPercent: 0,
  },
  lastSubmissionAt: "",
};

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Nao definido";
}

function compactWallet(value) {
  const text = String(value || "").trim();
  return text.length <= 14 ? text : `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function telegramGreeting(webApp) {
  const user = webApp?.initDataUnsafe?.user;
  if (user?.first_name) return `Sessao Telegram ativa para ${user.first_name}`;
  if (user?.username) return `Sessao Telegram ativa para @${user.username}`;
  return "Abra esta pagina pelo bot para usar como Telegram Mini App.";
}

function getSubmissionTone(status) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "under_review") return "under_review";
  return "submitted";
}

function getSessionMessage(session) {
  if (!session) {
    return "Autentique a wallet na home para enviar prova e acompanhar a revisao.";
  }

  return `Wallet ativa: ${compactWallet(session.walletAddress)}`;
}

export default function LaunchpadProjectDetailPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const [appConfig, setAppConfig] = useState(FALLBACK_CONFIG);
  const [project, setProject] = useState(null);
  const [viewer, setViewer] = useState(EMPTY_VIEWER);
  const [session, setSession] = useState(null);
  const [sessionToken, setSessionToken] = useState("");
  const [telegramMessage, setTelegramMessage] = useState(
    "Abra esta pagina pelo bot para usar como Telegram Mini App.",
  );
  const [pageState, setPageState] = useState({
    status: "loading",
    message: "Carregando campanha exclusiva...",
  });
  const [taskProofs, setTaskProofs] = useState({});
  const [taskStates, setTaskStates] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY) || "";
    setSessionToken(storedToken);
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    webApp.ready();
    webApp.expand();
    setTelegramMessage(telegramGreeting(webApp));
  }, []);

  useEffect(() => {
    if (!router.isReady || !slug) {
      return undefined;
    }

    let cancelled = false;

    async function loadPage() {
      setPageState({
        status: "loading",
        message: "Carregando campanha exclusiva...",
      });

      const [configResult, detailResult, sessionResult] = await Promise.allSettled([
        getConfig(),
        getPublicLaunchpadProject(slug, sessionToken || undefined),
        sessionToken ? getSession(sessionToken) : Promise.resolve(null),
      ]);

      if (cancelled) {
        return;
      }

      if (configResult.status === "fulfilled") {
        startTransition(() => {
          setAppConfig(configResult.value);
        });
      }

      if (sessionResult.status === "fulfilled" && sessionResult.value?.session) {
        setSession(sessionResult.value.session);
      } else if (sessionToken) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
        setSessionToken("");
        setSession(null);
      }

      if (detailResult.status === "fulfilled") {
        startTransition(() => {
          setProject(detailResult.value.project);
          setViewer(detailResult.value.viewer || EMPTY_VIEWER);
        });
        setPageState({
          status: "success",
          message: "Campanha carregada.",
        });
      } else {
        setProject(null);
        setViewer(EMPTY_VIEWER);
        setPageState({
          status: "error",
          message: detailResult.reason?.message || "Nao foi possivel carregar a campanha.",
        });
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, sessionToken, slug]);

  async function refreshProject(activeToken = sessionToken) {
    const response = await getPublicLaunchpadProject(slug, activeToken || undefined);
    startTransition(() => {
      setProject(response.project);
      setViewer(response.viewer || EMPTY_VIEWER);
    });
  }

  function updateTaskProof(taskId, value) {
    setTaskProofs((current) => ({ ...current, [taskId]: value }));
  }

  async function handleTaskSubmit(taskId) {
    if (!project || !sessionToken) {
      return;
    }

    setTaskStates((current) => ({
      ...current,
      [taskId]: { status: "loading", message: "Enviando prova..." },
    }));

    try {
      await submitLaunchpadTask(
        project.id,
        taskId,
        { proofText: taskProofs[taskId] || "" },
        sessionToken,
      );

      setTaskProofs((current) => ({ ...current, [taskId]: "" }));
      await refreshProject(sessionToken);
      setTaskStates((current) => ({
        ...current,
        [taskId]: { status: "success", message: "Proof enviada para revisao." },
      }));
    } catch (error) {
      setTaskStates((current) => ({
        ...current,
        [taskId]: { status: "error", message: error.message },
      }));
    }
  }

  const submissionSummary = viewer.submissionSummary || EMPTY_VIEWER.submissionSummary;
  const scheduleLabel =
    project?.startsAt || project?.endsAt
      ? `${formatDateTime(project?.startsAt)} -> ${formatDateTime(project?.endsAt)}`
      : "Sem janela definida";
  const coverStyle = project?.coverImageUrl
    ? {
        backgroundImage: `linear-gradient(160deg, rgba(13, 16, 32, 0.82), rgba(13, 16, 32, 0.36)), url(${project.coverImageUrl})`,
      }
    : undefined;

  return (
    <>
      <Head>
        <title>
          {project?.title ? `${project.title} | ${appConfig.appName}` : `${appConfig.appName} Launchpad`}
        </title>
        <meta
          name="description"
          content={project?.shortDescription || "Campanha exclusiva do launchpad curado."}
        />
      </Head>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <main className={shared.shell}>
        <div className={`${shared.orb} ${shared.orbPrimary}`} />
        <div className={`${shared.orb} ${shared.orbWarm}`} />

        <div className={styles.page}>
          <header className={styles.topbar}>
            <div className={styles.topbarLinks}>
              <Link className={shared.secondaryLink} href="/#exclusive-launchpad">
                Voltar ao launchpad
              </Link>
              <Link className={shared.secondaryLink} href="/">
                Home
              </Link>
            </div>
            <div className={styles.topbarMeta}>
              <span className={styles.telegramMeta}>{telegramMessage}</span>
              <span className={styles.viewerMeta}>{getSessionMessage(session)}</span>
            </div>
          </header>

          {project ? (
            <>
              <section className={styles.hero}>
                <div className={styles.heroCopy}>
                  <div className={styles.badgeRow}>
                    <span className={styles.badge}>{project.badge}</span>
                    <span className={styles.badgeGhost}>{appConfig.launchpad.mode}</span>
                  </div>
                  <p className={styles.eyebrow}>Campanha exclusiva</p>
                  <h1 className={styles.title}>{project.title}</h1>
                  <p className={styles.short}>{project.shortDescription}</p>
                  <p className={styles.description}>{project.description}</p>
                  <div className={styles.metricRow}>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Reward pool</span>
                      <strong className={styles.metricValue}>
                        {project.rewardAmount || 0} {project.rewardToken || project.rewardLabel}
                      </strong>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Tasks</span>
                      <strong className={styles.metricValue}>{project.taskCount}</strong>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Participants</span>
                      <strong className={styles.metricValue}>{project.participantCount}</strong>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Submissions</span>
                      <strong className={styles.metricValue}>{project.submissionCount}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.coverCard} style={coverStyle}>
                  <div className={styles.coverTop}>
                    {project.logoUrl ? (
                      <img
                        alt={project.title}
                        className={styles.logo}
                        src={project.logoUrl}
                      />
                    ) : (
                      <div className={styles.logoFallback}>{project.badge}</div>
                    )}
                    <span className={styles.coverStatus}>{project.status}</span>
                  </div>
                  <div className={styles.coverBody}>
                    <p className={styles.coverLabel}>Janela</p>
                    <p className={styles.coverValue}>{scheduleLabel}</p>
                    <p className={styles.coverLabel}>Review</p>
                    <p className={styles.coverValue}>
                      {appConfig.launchpad.submissionReview}
                    </p>
                    <p className={styles.coverLabel}>Criado por</p>
                    <p className={styles.coverValue}>{compactWallet(project.createdBy)}</p>
                  </div>
                </div>
              </section>

              <section className={styles.workspace}>
                <div className={styles.mainColumn}>
                  <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>Tarefas</p>
                        <h2 className={styles.panelTitle}>Fluxo operacional da campanha</h2>
                      </div>
                      <div className={styles.panelMeta}>
                        <span className={styles.panelMetaLabel}>Slug</span>
                        <span className={styles.panelMetaValue}>{project.slug}</span>
                      </div>
                    </div>

                    {project.tasks.length === 0 ? (
                      <p className={shared.smallPrint}>
                        Esta campanha ainda nao tem tarefas ativas.
                      </p>
                    ) : (
                      <div className={styles.taskList}>
                        {project.tasks.map((task) => {
                          const taskState = taskStates[task.id];
                          const submission = task.mySubmission;
                          const tone = getSubmissionTone(submission?.status);

                          return (
                            <article className={styles.taskCard} key={task.id}>
                              <div className={styles.taskHeader}>
                                <div>
                                  <p className={styles.taskTitle}>{task.title}</p>
                                  <p className={styles.taskDescription}>
                                    {task.description || "Tarefa ativa desta campanha."}
                                  </p>
                                </div>
                                <div className={styles.taskReward}>
                                  +{task.rewardPoints} {task.rewardLabel || "pts"}
                                </div>
                              </div>

                              <div className={styles.taskMetaRow}>
                                <span className={styles.metaChip}>{task.taskType}</span>
                                <span className={styles.metaChip}>
                                  {task.submissionCount} submissions
                                </span>
                                {submission ? (
                                  <span
                                    className={styles.statusPill}
                                    data-status={tone}
                                  >
                                    Minha submission: {submission.status}
                                  </span>
                                ) : (
                                  <span className={styles.metaChip}>Sem submission</span>
                                )}
                                {task.targetUrl ? (
                                  <a
                                    className={styles.taskLink}
                                    href={task.targetUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    Abrir destino
                                  </a>
                                ) : null}
                              </div>

                              {viewer.authenticated ? (
                                <div className={styles.proofBox}>
                                  <input
                                    className={shared.field}
                                    onChange={(event) =>
                                      updateTaskProof(task.id, event.target.value)
                                    }
                                    placeholder="Proof curta: username, link, tx, resumo"
                                    value={taskProofs[task.id] || ""}
                                  />
                                  <div className={styles.proofActions}>
                                    <button
                                      className={shared.actionButton}
                                      onClick={() => handleTaskSubmit(task.id)}
                                      type="button"
                                    >
                                      Enviar prova
                                    </button>
                                    <span className={styles.proofHint}>
                                      Wallet atual: {compactWallet(viewer.walletAddress)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className={styles.loginCallout}>
                                  <p className={styles.loginCalloutText}>
                                    Entre pela wallet na home para enviar proof e receber review.
                                  </p>
                                  <Link className={shared.secondaryLink} href="/#launch-form">
                                    Ir para login
                                  </Link>
                                </div>
                              )}

                              {submission?.reviewNote ? (
                                <div className={styles.reviewNote}>
                                  <p className={styles.reviewNoteLabel}>Review note</p>
                                  <p className={styles.reviewNoteBody}>{submission.reviewNote}</p>
                                </div>
                              ) : null}

                              {taskState ? (
                                <div
                                  className={`${shared.callout} ${
                                    taskState.status === "success"
                                      ? shared.success
                                      : taskState.status === "error"
                                        ? shared.error
                                        : ""
                                  }`}
                                >
                                  <p className={shared.calloutTitle}>Submission status</p>
                                  <p className={shared.calloutBody}>{taskState.message}</p>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>

                <aside className={styles.sideColumn}>
                  <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>Minha wallet</p>
                        <h2 className={styles.panelTitle}>Resumo de progresso</h2>
                      </div>
                    </div>

                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Tasks com proof</span>
                        <strong className={styles.summaryValue}>
                          {submissionSummary.total}
                        </strong>
                      </div>
                      <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Aprovadas</span>
                        <strong className={styles.summaryValue}>
                          {submissionSummary.approved}
                        </strong>
                      </div>
                      <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Em fila</span>
                        <strong className={styles.summaryValue}>
                          {submissionSummary.submitted + submissionSummary.underReview}
                        </strong>
                      </div>
                      <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Cobertura</span>
                        <strong className={styles.summaryValue}>
                          {submissionSummary.completionPercent}%
                        </strong>
                      </div>
                    </div>

                    <div
                      className={`${shared.callout} ${
                        session ? shared.success : ""
                      }`}
                    >
                      <p className={shared.calloutTitle}>Sessao</p>
                      <p className={shared.calloutBody}>{getSessionMessage(session)}</p>
                    </div>
                  </section>

                  <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>Historico</p>
                        <h2 className={styles.panelTitle}>Status por tarefa</h2>
                      </div>
                    </div>

                    {viewer.submissions.length === 0 ? (
                      <p className={shared.smallPrint}>
                        Nenhuma submission desta wallet nesta campanha ainda.
                      </p>
                    ) : (
                      <div className={styles.historyList}>
                        {viewer.submissions.map((submission) => (
                          <article className={styles.historyItem} key={submission.id}>
                            <div className={styles.historyTop}>
                              <p className={styles.historyTitle}>{submission.taskTitle}</p>
                              <span
                                className={styles.statusPill}
                                data-status={getSubmissionTone(submission.status)}
                              >
                                {submission.status}
                              </span>
                            </div>
                            <p className={styles.historyBody}>{submission.proofText || "Sem texto de prova."}</p>
                            <p className={styles.historyMeta}>
                              Atualizado em {formatDateTime(submission.updatedAt)}
                            </p>
                            {submission.reviewNote ? (
                              <p className={styles.historyReview}>
                                Nota do admin: {submission.reviewNote}
                              </p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </aside>
              </section>
            </>
          ) : (
            <section className={styles.fallbackPanel}>
              <div
                className={`${shared.callout} ${
                  pageState.status === "error" ? shared.error : ""
                }`}
              >
                <p className={shared.calloutTitle}>Launchpad status</p>
                <p className={shared.calloutBody}>{pageState.message}</p>
              </div>
              <div className={styles.fallbackActions}>
                <Link className={shared.secondaryLink} href="/#exclusive-launchpad">
                  Voltar ao board exclusivo
                </Link>
                <Link className={shared.secondaryLink} href="/">
                  Home
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
