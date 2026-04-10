const { randomUUID } = require("crypto");

const MAX_SLUG_LENGTH = 48;
const MAX_TITLE_LENGTH = 72;
const MAX_SHORT_DESCRIPTION_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1200;
const MAX_BADGE_LENGTH = 24;
const MAX_REWARD_LABEL_LENGTH = 48;
const MAX_TASK_TITLE_LENGTH = 72;
const MAX_TASK_DESCRIPTION_LENGTH = 280;
const VALID_PROJECT_STATUS = new Set(["draft", "published", "archived"]);
const VALID_TASK_STATUS = new Set(["active", "paused", "archived"]);
const VALID_SUBMISSION_STATUS = new Set([
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);
const VALID_TASK_TYPES = new Set([
  "follow_x",
  "join_telegram",
  "share_post",
  "visit_url",
  "custom",
]);

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value, fieldName, options = {}) {
  const text = trimString(value);
  const minLength = options.minLength || 1;
  const maxLength = options.maxLength || Number.POSITIVE_INFINITY;

  if (!text) {
    throw new Error(`${fieldName} é obrigatório.`);
  }

  if (text.length < minLength) {
    throw new Error(
      `${fieldName} precisa ter pelo menos ${minLength} caracteres.`,
    );
  }

  if (text.length > maxLength) {
    throw new Error(
      `${fieldName} precisa ter no máximo ${maxLength} caracteres.`,
    );
  }

  return text;
}

function normalizeSlug(value) {
  const raw = requireText(value, "Slug", {
    minLength: 3,
    maxLength: MAX_SLUG_LENGTH * 2,
  })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!raw || raw.length < 3) {
    throw new Error("Slug precisa ter ao menos 3 caracteres válidos.");
  }

  if (raw.length > MAX_SLUG_LENGTH) {
    throw new Error(`Slug precisa ter no máximo ${MAX_SLUG_LENGTH} caracteres.`);
  }

  return raw;
}

function normalizeOptionalUrl(value, fieldName) {
  const url = trimString(value);

  if (!url) {
    return "";
  }

  try {
    return new URL(url).toString();
  } catch (error) {
    throw new Error(`${fieldName} precisa ser uma URL válida.`);
  }
}

function normalizeInteger(value, fieldName, fallback = 0, minimum = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${fieldName} precisa ser um inteiro >= ${minimum}.`);
  }

  return parsed;
}

function normalizeDecimal(value, fieldName) {
  const text = trimString(value);

  if (!text) {
    return 0;
  }

  const normalized = Number(text.replace(",", "."));

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${fieldName} precisa ser um número >= 0.`);
  }

  return normalized;
}

function normalizeOptionalDate(value, fieldName) {
  const text = trimString(value);

  if (!text) {
    return null;
  }

  const parsed = Date.parse(text);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} precisa ser uma data válida.`);
  }

  return new Date(parsed).toISOString();
}

function normalizeStatus(value, validSet, fieldName, fallback) {
  const normalized = trimString(value) || fallback;

  if (!validSet.has(normalized)) {
    throw new Error(`${fieldName} inválido.`);
  }

  return normalized;
}

function normalizeProjectInput(body = {}) {
  const startsAt = normalizeOptionalDate(body.startsAt, "Início");
  const endsAt = normalizeOptionalDate(body.endsAt, "Fim");

  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
    throw new Error("Fim precisa ser posterior ao início.");
  }

  return {
    id: randomUUID(),
    slug: normalizeSlug(body.slug),
    title: requireText(body.title, "Título", {
      minLength: 3,
      maxLength: MAX_TITLE_LENGTH,
    }),
    badge: (trimString(body.badge) || "exclusive").slice(0, MAX_BADGE_LENGTH),
    shortDescription: requireText(body.shortDescription, "Resumo curto", {
      minLength: 12,
      maxLength: MAX_SHORT_DESCRIPTION_LENGTH,
    }),
    description: requireText(body.description, "Descrição", {
      minLength: 24,
      maxLength: MAX_DESCRIPTION_LENGTH,
    }),
    logoUrl: normalizeOptionalUrl(body.logoUrl, "Logo"),
    coverImageUrl: normalizeOptionalUrl(body.coverImageUrl, "Cover"),
    rewardLabel: trimString(body.rewardLabel).slice(0, MAX_REWARD_LABEL_LENGTH),
    rewardToken: trimString(body.rewardToken).toUpperCase().slice(0, 16),
    rewardAmount: normalizeDecimal(body.rewardAmount, "Reward amount"),
    participantLimit: normalizeInteger(
      body.participantLimit,
      "Limite de participantes",
      0,
      0,
    ),
    sortOrder: normalizeInteger(body.sortOrder, "Sort order", 0, 0),
    status: normalizeStatus(
      body.status,
      VALID_PROJECT_STATUS,
      "Status do projeto",
      "draft",
    ),
    startsAt,
    endsAt,
    createdBy: trimString(body.createdBy) || "admin",
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeProjectContentUpdateInput(body = {}) {
  const startsAt = normalizeOptionalDate(body.startsAt, "Início");
  const endsAt = normalizeOptionalDate(body.endsAt, "Fim");

  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
    throw new Error("Fim precisa ser posterior ao início.");
  }

  return {
    slug: normalizeSlug(body.slug),
    title: requireText(body.title, "Título", {
      minLength: 3,
      maxLength: MAX_TITLE_LENGTH,
    }),
    badge: (trimString(body.badge) || "exclusive").slice(0, MAX_BADGE_LENGTH),
    shortDescription: requireText(body.shortDescription, "Resumo curto", {
      minLength: 12,
      maxLength: MAX_SHORT_DESCRIPTION_LENGTH,
    }),
    description: requireText(body.description, "Descrição", {
      minLength: 24,
      maxLength: MAX_DESCRIPTION_LENGTH,
    }),
    logoUrl: normalizeOptionalUrl(body.logoUrl, "Logo"),
    coverImageUrl: normalizeOptionalUrl(body.coverImageUrl, "Cover"),
    rewardLabel: trimString(body.rewardLabel).slice(0, MAX_REWARD_LABEL_LENGTH),
    rewardToken: trimString(body.rewardToken).toUpperCase().slice(0, 16),
    rewardAmount: normalizeDecimal(body.rewardAmount, "Reward amount"),
    participantLimit: normalizeInteger(
      body.participantLimit,
      "Limite de participantes",
      0,
      0,
    ),
    sortOrder: normalizeInteger(body.sortOrder, "Sort order", 0, 0),
    startsAt,
    endsAt,
  };
}

function normalizeTaskInput(body = {}) {
  return {
    id: randomUUID(),
    title: requireText(body.title, "Título da tarefa", {
      minLength: 3,
      maxLength: MAX_TASK_TITLE_LENGTH,
    }),
    description: trimString(body.description).slice(0, MAX_TASK_DESCRIPTION_LENGTH),
    taskType: normalizeStatus(
      trimString(body.taskType) || "custom",
      VALID_TASK_TYPES,
      "Tipo da tarefa",
      "custom",
    ),
    targetUrl: normalizeOptionalUrl(body.targetUrl, "URL alvo"),
    rewardPoints: normalizeInteger(body.rewardPoints, "Reward points", 0, 0),
    rewardLabel: trimString(body.rewardLabel).slice(0, MAX_REWARD_LABEL_LENGTH),
    sortOrder: normalizeInteger(body.sortOrder, "Sort order", 0, 0),
    status: normalizeStatus(
      body.status,
      VALID_TASK_STATUS,
      "Status da tarefa",
      "active",
    ),
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTaskContentUpdateInput(body = {}) {
  return {
    title: requireText(body.title, "Título da tarefa", {
      minLength: 3,
      maxLength: MAX_TASK_TITLE_LENGTH,
    }),
    description: trimString(body.description).slice(0, MAX_TASK_DESCRIPTION_LENGTH),
    taskType: normalizeStatus(
      trimString(body.taskType) || "custom",
      VALID_TASK_TYPES,
      "Tipo da tarefa",
      "custom",
    ),
    targetUrl: normalizeOptionalUrl(body.targetUrl, "URL alvo"),
    rewardPoints: normalizeInteger(body.rewardPoints, "Reward points", 0, 0),
    rewardLabel: trimString(body.rewardLabel).slice(0, MAX_REWARD_LABEL_LENGTH),
    sortOrder: normalizeInteger(body.sortOrder, "Sort order", 0, 0),
  };
}

function normalizeSubmissionInput(body = {}, session = null) {
  return {
    id: randomUUID(),
    walletAddress: requireText(
      session?.walletAddress,
      "Wallet autenticada",
      { minLength: 6, maxLength: 128 },
    ),
    sessionId: session?.id || null,
    proofText: trimString(body.proofText).slice(0, 280),
    proofUrl: normalizeOptionalUrl(body.proofUrl, "Proof URL"),
    status: "submitted",
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeProjectStatusUpdate(body = {}) {
  return {
    status: normalizeStatus(
      body.status,
      VALID_PROJECT_STATUS,
      "Status do projeto",
      "draft",
    ),
  };
}

function normalizeTaskStatusUpdate(body = {}) {
  return {
    status: normalizeStatus(
      body.status,
      VALID_TASK_STATUS,
      "Status da tarefa",
      "active",
    ),
  };
}

function normalizeSubmissionModerationInput(body = {}) {
  return {
    status: normalizeStatus(
      body.status,
      VALID_SUBMISSION_STATUS,
      "Status da submission",
      "submitted",
    ),
    reviewNote: trimString(body.reviewNote).slice(0, 500),
    reviewedBy: trimString(body.reviewedBy) || "admin",
    reviewedAt: new Date().toISOString(),
  };
}

module.exports = {
  normalizeProjectInput,
  normalizeProjectContentUpdateInput,
  normalizeProjectStatusUpdate,
  normalizeSubmissionInput,
  normalizeSubmissionModerationInput,
  normalizeTaskContentUpdateInput,
  normalizeTaskStatusUpdate,
  normalizeTaskInput,
};
