import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createAdminLaunchpadProject,
  createAdminLaunchpadTask,
  getAdminAccess,
  getAdminLaunches,
  getAdminLaunchpadProjects,
  getAdminLaunchpadSubmissions,
  getAdminOverview,
  getSession,
  updateAdminLaunchpadProject,
  updateAdminLaunchpadProjectContent,
  updateAdminLaunchpadSubmission,
  updateAdminLaunchpadTask,
  updateAdminLaunchpadTaskContent,
} from "../lib/api";
import styles from "../styles/Admin.module.css";

const SESSION_STORAGE_KEY = "ackimeme_session_token";
const INITIAL_PROJECT_FORM = {
  slug: "",
  title: "",
  badge: "exclusive",
  shortDescription: "",
  description: "",
  logoUrl: "",
  coverImageUrl: "",
  rewardToken: "",
  rewardAmount: "",
  rewardLabel: "",
  participantLimit: "0",
  status: "published",
  sortOrder: "0",
};

const INITIAL_TASK_FORM = {
  title: "",
  description: "",
  taskType: "custom",
  targetUrl: "",
  rewardPoints: "0",
  rewardLabel: "pts",
  sortOrder: "0",
  status: "active",
};

function compactWallet(value) {
  const text = String(value || "").trim();
  return text.length <= 14 ? text : `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function projectToForm(project) {
  return {
    slug: project.slug || "",
    title: project.title || "",
    badge: project.badge || "exclusive",
    shortDescription: project.shortDescription || "",
    description: project.description || "",
    logoUrl: project.logoUrl || "",
    coverImageUrl: project.coverImageUrl || "",
    rewardToken: project.rewardToken || "",
    rewardAmount: String(project.rewardAmount ?? ""),
    rewardLabel: project.rewardLabel || "",
    participantLimit: String(project.participantLimit ?? 0),
    status: project.status || "draft",
    sortOrder: String(project.sortOrder ?? 0),
  };
}

function taskToForm(task) {
  return {
    title: task.title || "",
    description: task.description || "",
    taskType: task.taskType || "custom",
    targetUrl: task.targetUrl || "",
    rewardPoints: String(task.rewardPoints ?? 0),
    rewardLabel: task.rewardLabel || "pts",
    sortOrder: String(task.sortOrder ?? 0),
    status: task.status || "active",
  };
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [session, setSession] = useState(null);
  const [adminAccess, setAdminAccess] = useState(null);
  const [overview, setOverview] = useState(null);
  const [launches, setLaunches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [editingProjectId, setEditingProjectId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [projectForm, setProjectForm] = useState(INITIAL_PROJECT_FORM);
  const [taskForm, setTaskForm] = useState(INITIAL_TASK_FORM);
  const [reviewNotes, setReviewNotes] = useState({});
  const [status, setStatus] = useState("Informe o admin token do backend.");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!storedToken) {
      return;
    }

    getSession(storedToken)
      .then((response) => {
        setSessionToken(storedToken);
        setSession(response.session);
      })
      .catch(() => {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      });
  }, []);

  function getAdminRequestOptions() {
    return {
      adminToken,
      token: sessionToken,
    };
  }

  async function handleLoad() {
    setStatus("Carregando dashboard...");
    try {
      const [
        accessResponse,
        overviewResponse,
        launchesResponse,
        projectsResponse,
        submissionsResponse,
      ] = await Promise.all([
        getAdminAccess(getAdminRequestOptions()),
        getAdminOverview(getAdminRequestOptions()),
        getAdminLaunches(getAdminRequestOptions()),
        getAdminLaunchpadProjects(getAdminRequestOptions()),
        getAdminLaunchpadSubmissions(getAdminRequestOptions()),
      ]);

      setAdminAccess(accessResponse.access);
      setOverview(overviewResponse.overview);
      setLaunches(launchesResponse.launches || []);
      setProjects(projectsResponse.projects || []);
      setSubmissions(submissionsResponse.submissions || []);
      setSelectedProjectId((current) => current || projectsResponse.projects?.[0]?.id || "");
      setStatus("Dashboard carregado.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleCreateProject() {
    setStatus("Criando projeto exclusivo...");
    try {
      await createAdminLaunchpadProject(getAdminRequestOptions(), projectForm);
      setProjectForm(INITIAL_PROJECT_FORM);
      setEditingProjectId("");
      await handleLoad();
      setStatus("Projeto exclusivo criado.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleCreateTask() {
    if (!selectedProjectId) {
      setStatus("Selecione um projeto exclusivo antes de criar a tarefa.");
      return;
    }

    setStatus("Criando tarefa...");
    try {
      await createAdminLaunchpadTask(getAdminRequestOptions(), selectedProjectId, taskForm);
      setTaskForm(INITIAL_TASK_FORM);
      setEditingTaskId("");
      await handleLoad();
      setStatus("Tarefa criada.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleSaveProjectEdit() {
    if (!editingProjectId) {
      return;
    }

    setStatus("Salvando edição do projeto...");
    try {
      await updateAdminLaunchpadProjectContent(
        getAdminRequestOptions(),
        editingProjectId,
        projectForm,
      );
      setEditingProjectId("");
      setProjectForm(INITIAL_PROJECT_FORM);
      await handleLoad();
      setStatus("Projeto atualizado.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleSaveTaskEdit() {
    if (!editingTaskId) {
      return;
    }

    setStatus("Salvando edição da tarefa...");
    try {
      await updateAdminLaunchpadTaskContent(
        getAdminRequestOptions(),
        editingTaskId,
        taskForm,
      );
      setEditingTaskId("");
      setTaskForm(INITIAL_TASK_FORM);
      await handleLoad();
      setStatus("Tarefa atualizada.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function handleEditProject(project) {
    setEditingProjectId(project.id);
    setProjectForm(projectToForm(project));
  }

  function handleEditTask(projectId, task) {
    setSelectedProjectId(projectId);
    setEditingTaskId(task.id);
    setTaskForm(taskToForm(task));
  }

  function handleCancelProjectEdit() {
    setEditingProjectId("");
    setProjectForm(INITIAL_PROJECT_FORM);
  }

  function handleCancelTaskEdit() {
    setEditingTaskId("");
    setTaskForm(INITIAL_TASK_FORM);
  }

  async function handleProjectStatus(projectId, nextStatus) {
    setStatus(`Atualizando projeto para ${nextStatus}...`);
    try {
      await updateAdminLaunchpadProject(getAdminRequestOptions(), projectId, {
        status: nextStatus,
      });
      await handleLoad();
      setStatus(`Projeto atualizado para ${nextStatus}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleTaskStatus(taskId, nextStatus) {
    setStatus(`Atualizando tarefa para ${nextStatus}...`);
    try {
      await updateAdminLaunchpadTask(getAdminRequestOptions(), taskId, {
        status: nextStatus,
      });
      await handleLoad();
      setStatus(`Tarefa atualizada para ${nextStatus}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleSubmissionStatus(submissionId, nextStatus) {
    setStatus(`Moderando submission para ${nextStatus}...`);
    try {
      await updateAdminLaunchpadSubmission(getAdminRequestOptions(), submissionId, {
        status: nextStatus,
        reviewNote: reviewNotes[submissionId] || "",
      });
      await handleLoad();
      setStatus(`Submission atualizada para ${nextStatus}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <>
      <Head>
        <title>AckiMeme Admin</title>
      </Head>

      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero}>
            <div>
              <h1 className={styles.title}>AckiMeme Admin</h1>
              <p className={styles.copy}>
                O board público continua separado do launchpad exclusivo. Aqui o
                admin cria campanhas, controla status e modera submissions.
              </p>
            </div>
            <Link className={styles.secondary} href="/">
              Voltar ao app
            </Link>
          </section>

          <section className={styles.grid}>
            <aside className={styles.stack}>
              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Acesso</h2>
                <input
                  className={`${styles.field} ${styles.mono}`}
                  onChange={(event) => setAdminToken(event.target.value)}
                  placeholder="ADMIN_TOKEN"
                  value={adminToken}
                />
                <p className={styles.small}>
                  Wallet da sessão atual: {session?.walletAddress || "nenhuma"}
                </p>
                <p className={styles.small}>
                  Modo admin atual:{" "}
                  {adminAccess?.authMode
                    ? `${adminAccess.authMode}${adminAccess.walletAddress ? ` (${adminAccess.walletAddress})` : ""}`
                    : "use wallet allowlist ou ADMIN_TOKEN"}
                </p>
                <div className={styles.buttonRow}>
                  <button className={styles.primary} onClick={handleLoad} type="button">
                    Carregar dashboard
                  </button>
                </div>
                <p className={styles.small}>{status}</p>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>
                  {editingProjectId ? "Editar projeto exclusivo" : "Novo projeto exclusivo"}
                </h2>
                <div className={styles.formGrid}>
                  <input
                    className={styles.field}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="slug"
                    value={projectForm.slug}
                  />
                  <input
                    className={styles.field}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Título"
                    value={projectForm.title}
                  />
                  <input
                    className={styles.field}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, badge: event.target.value }))
                    }
                    placeholder="Badge"
                    value={projectForm.badge}
                  />
                  <input
                    className={styles.field}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        shortDescription: event.target.value,
                      }))
                    }
                    placeholder="Resumo curto"
                    value={projectForm.shortDescription}
                  />
                  <textarea
                    className={styles.area}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Descrição"
                    value={projectForm.description}
                  />
                  <div className={styles.inlineFields}>
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          logoUrl: event.target.value,
                        }))
                      }
                      placeholder="Logo URL"
                      value={projectForm.logoUrl}
                    />
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          coverImageUrl: event.target.value,
                        }))
                      }
                      placeholder="Cover URL"
                      value={projectForm.coverImageUrl}
                    />
                  </div>
                  <div className={styles.inlineFields}>
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          rewardToken: event.target.value,
                        }))
                      }
                      placeholder="Reward token"
                      value={projectForm.rewardToken}
                    />
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          rewardAmount: event.target.value,
                        }))
                      }
                      placeholder="Reward amount"
                      value={projectForm.rewardAmount}
                    />
                  </div>
                  <div className={styles.inlineFields}>
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          rewardLabel: event.target.value,
                        }))
                      }
                      placeholder="Reward label"
                      value={projectForm.rewardLabel}
                    />
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          participantLimit: event.target.value,
                        }))
                      }
                      placeholder="Participant limit"
                      value={projectForm.participantLimit}
                    />
                  </div>
                  <div className={styles.inlineFields}>
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                      placeholder="Sort order"
                      value={projectForm.sortOrder}
                    />
                    <select
                      className={styles.field}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, status: event.target.value }))
                      }
                      value={projectForm.status}
                    >
                      <option value="published">published</option>
                      <option value="draft">draft</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                </div>
                <div className={styles.buttonRow}>
                  {editingProjectId ? (
                    <>
                      <button
                        className={styles.primary}
                        onClick={handleSaveProjectEdit}
                        type="button"
                      >
                        Salvar projeto
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={handleCancelProjectEdit}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.primary}
                      onClick={handleCreateProject}
                      type="button"
                    >
                      Criar projeto
                    </button>
                  )}
                </div>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>
                  {editingTaskId ? "Editar tarefa" : "Nova tarefa"}
                </h2>
                <select
                  className={styles.field}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  value={selectedProjectId}
                >
                  <option value="">Selecione um projeto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
                <div className={styles.formGrid}>
                  <input
                    className={styles.field}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Título da tarefa"
                    value={taskForm.title}
                  />
                  <textarea
                    className={styles.area}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Descrição"
                    value={taskForm.description}
                  />
                  <div className={styles.inlineFields}>
                    <select
                      className={styles.field}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, taskType: event.target.value }))
                      }
                      value={taskForm.taskType}
                    >
                      <option value="custom">custom</option>
                      <option value="follow_x">follow_x</option>
                      <option value="join_telegram">join_telegram</option>
                      <option value="share_post">share_post</option>
                      <option value="visit_url">visit_url</option>
                    </select>
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, targetUrl: event.target.value }))
                      }
                      placeholder="URL da tarefa"
                      value={taskForm.targetUrl}
                    />
                  </div>
                  <div className={styles.inlineFields}>
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          rewardPoints: event.target.value,
                        }))
                      }
                      placeholder="Reward points"
                      value={taskForm.rewardPoints}
                    />
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          rewardLabel: event.target.value,
                        }))
                      }
                      placeholder="Reward label"
                      value={taskForm.rewardLabel}
                    />
                    <input
                      className={styles.field}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                      placeholder="Sort order"
                      value={taskForm.sortOrder}
                    />
                  </div>
                </div>
                <div className={styles.buttonRow}>
                  {editingTaskId ? (
                    <>
                      <button
                        className={styles.primary}
                        onClick={handleSaveTaskEdit}
                        type="button"
                      >
                        Salvar tarefa
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={handleCancelTaskEdit}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button className={styles.primary} onClick={handleCreateTask} type="button">
                      Criar tarefa
                    </button>
                  )}
                </div>
              </section>
            </aside>

            <section className={styles.stack}>
              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Visão geral</h2>
                {overview ? (
                  <>
                    <div className={styles.stats}>
                      <div className={styles.stat}>
                        <p className={styles.statLabel}>Launches</p>
                        <p className={styles.statValue}>{overview.launches}</p>
                      </div>
                      <div className={styles.stat}>
                        <p className={styles.statLabel}>Exclusive projects</p>
                        <p className={styles.statValue}>{overview.launchpadProjects}</p>
                      </div>
                      <div className={styles.stat}>
                        <p className={styles.statLabel}>Exclusive tasks</p>
                        <p className={styles.statValue}>{overview.launchpadTasks}</p>
                      </div>
                      <div className={styles.stat}>
                        <p className={styles.statLabel}>Task submissions</p>
                        <p className={styles.statValue}>{overview.launchpadSubmissions}</p>
                      </div>
                    </div>
                    <div className={styles.statusSummary}>
                      {overview.launchpadSubmissionStatusBreakdown?.map((item) => (
                        <div className={styles.badge} key={item.status}>
                          {item.status}: {item.count}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={styles.small}>Carregue o dashboard para ver métricas.</p>
                )}
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Launchpad exclusivo</h2>
                <div className={styles.list}>
                  {projects.map((project) => (
                    <div className={styles.card} key={project.id}>
                      <p className={styles.cardTitle}>
                        {project.title} <span className={styles.badge}>{project.status}</span>
                      </p>
                      <p className={styles.cardBody}>
                        {project.shortDescription}
                        <br />
                        Tasks: {project.taskCount} | Participants: {project.participantCount} |
                        Submissions: {project.submissionCount}
                      </p>
                      <div className={styles.buttonRow}>
                        <button
                          className={styles.secondary}
                          onClick={() => handleEditProject(project)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className={styles.secondary}
                          onClick={() => handleProjectStatus(project.id, "published")}
                          type="button"
                        >
                          Publish
                        </button>
                        <button
                          className={styles.secondary}
                          onClick={() => handleProjectStatus(project.id, "draft")}
                          type="button"
                        >
                          Draft
                        </button>
                        <button
                          className={styles.secondary}
                          onClick={() => handleProjectStatus(project.id, "archived")}
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                      {project.tasks?.length ? (
                        <div className={styles.taskStack}>
                          {project.tasks.map((task) => (
                            <div className={styles.taskItem} key={task.id}>
                              <div className={styles.taskHeader}>
                                <strong>{task.title}</strong>
                                <span className={styles.badge}>{task.status}</span>
                              </div>
                              <div className={styles.taskMeta}>
                                {task.taskType} | {task.rewardPoints} {task.rewardLabel || "pts"} |
                                {` ${task.submissionCount} submissions`}
                              </div>
                              <div className={styles.buttonRow}>
                                <button
                                  className={styles.secondary}
                                  onClick={() => handleEditTask(project.id, task)}
                                  type="button"
                                >
                                  Editar
                                </button>
                                <button
                                  className={styles.secondary}
                                  onClick={() => handleTaskStatus(task.id, "active")}
                                  type="button"
                                >
                                  Ativar
                                </button>
                                <button
                                  className={styles.secondary}
                                  onClick={() => handleTaskStatus(task.id, "paused")}
                                  type="button"
                                >
                                  Pausar
                                </button>
                                <button
                                  className={styles.secondary}
                                  onClick={() => handleTaskStatus(task.id, "archived")}
                                  type="button"
                                >
                                  Arquivar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Submissions para moderação</h2>
                <div className={styles.list}>
                  {submissions.map((submission) => (
                    <div className={styles.card} key={submission.id}>
                      <p className={styles.cardTitle}>
                        {submission.projectTitle} / {submission.taskTitle}
                      </p>
                      <p className={styles.cardBody}>
                        Wallet: {compactWallet(submission.walletAddress)}
                        <br />
                        Status: {submission.status}
                        <br />
                        Proof: {submission.proofText || "-"}
                        <br />
                        Review note: {submission.reviewNote || "-"}
                      </p>
                      <textarea
                        className={styles.area}
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [submission.id]: event.target.value,
                          }))
                        }
                        placeholder="Nota da revisão"
                        value={reviewNotes[submission.id] ?? submission.reviewNote ?? ""}
                      />
                      <div className={styles.buttonRow}>
                        <button
                          className={styles.primary}
                          onClick={() => handleSubmissionStatus(submission.id, "approved")}
                          type="button"
                        >
                          Aprovar
                        </button>
                        <button
                          className={styles.secondary}
                          onClick={() => handleSubmissionStatus(submission.id, "under_review")}
                          type="button"
                        >
                          Revisão
                        </button>
                        <button
                          className={styles.secondary}
                          onClick={() => handleSubmissionStatus(submission.id, "rejected")}
                          type="button"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Feed público geral</h2>
                <div className={styles.list}>
                  {launches.map((launch) => (
                    <div className={styles.card} key={launch.id}>
                      <p className={styles.cardTitle}>
                        {launch.launchRequest.coin.name} ({launch.launchRequest.coin.symbol})
                      </p>
                      <p className={styles.cardBody}>
                        Status: {launch.status}
                        <br />
                        Fee: {launch.treasuryPayment.amount} {launch.treasuryPayment.tokenSymbol}
                        <br />
                        Risk: {launch.riskProfile.status} / {launch.riskProfile.score}
                        <br />
                        Creator: {launch.launchRequest.creator.wallet}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}
