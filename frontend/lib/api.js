const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.adminToken ? { "X-Admin-Token": options.adminToken } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function normalizeAdminOptions(value) {
  if (typeof value === "string") {
    return { adminToken: value };
  }

  return value || {};
}

export function getConfig() {
  return request("/config");
}

export function createAuthChallenge(payload) {
  return request("/auth/challenge", {
    method: "POST",
    body: payload,
  });
}

export function verifyAuthChallenge(payload) {
  return request("/auth/verify", {
    method: "POST",
    body: payload,
  });
}

export function getSession(token) {
  return request("/auth/session", { token });
}

export function logout(token) {
  return request("/auth/logout", {
    method: "POST",
    token,
  });
}

export function verifyPayment(payload) {
  return request("/verify-payment", {
    method: "POST",
    body: payload,
  });
}

export function createLaunchRequest(payload, token) {
  return request("/launch-request", {
    method: "POST",
    body: payload,
    token,
  });
}

export function getMyLaunches(token) {
  return request("/launches/my", { token });
}

export function getPublicLaunches() {
  return request("/launches/public");
}

export function getPublicLaunchpadProjects() {
  return request("/launchpad/projects");
}

export function getPublicLaunchpadProject(slug, token) {
  return request(`/launchpad/projects/${encodeURIComponent(slug)}`, { token });
}

export function getMyLaunchpadSubmissions(token) {
  return request("/launchpad/submissions/my", { token });
}

export function submitLaunchpadTask(projectId, taskId, payload, token) {
  return request(`/launchpad/tasks/${taskId}/submit`, {
    method: "POST",
    body: {
      ...payload,
      projectId,
    },
    token,
  });
}

export function getAdminOverview(options) {
  return request("/admin/overview", normalizeAdminOptions(options));
}

export function getAdminLaunches(options) {
  return request("/admin/launches", normalizeAdminOptions(options));
}

export function getAdminAccess(options) {
  return request("/admin/access", normalizeAdminOptions(options));
}

export function getAdminLaunchpadProjects(options) {
  return request("/admin/launchpad/projects", normalizeAdminOptions(options));
}

export function getAdminLaunchpadSubmissions(options) {
  return request("/admin/launchpad/submissions", normalizeAdminOptions(options));
}

export function createAdminLaunchpadProject(options, payload) {
  return request("/admin/launchpad/projects", {
    method: "POST",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}

export function updateAdminLaunchpadProject(options, projectId, payload) {
  return request(`/admin/launchpad/projects/${projectId}`, {
    method: "PATCH",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}

export function updateAdminLaunchpadProjectContent(options, projectId, payload) {
  return request(`/admin/launchpad/projects/${projectId}/content`, {
    method: "PATCH",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}

export function createAdminLaunchpadTask(options, projectId, payload) {
  return request(`/admin/launchpad/projects/${projectId}/tasks`, {
    method: "POST",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}

export function updateAdminLaunchpadTask(options, taskId, payload) {
  return request(`/admin/launchpad/tasks/${taskId}`, {
    method: "PATCH",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}

export function updateAdminLaunchpadTaskContent(options, taskId, payload) {
  return request(`/admin/launchpad/tasks/${taskId}/content`, {
    method: "PATCH",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}

export function updateAdminLaunchpadSubmission(options, submissionId, payload) {
  return request(`/admin/launchpad/submissions/${submissionId}`, {
    method: "PATCH",
    body: payload,
    ...normalizeAdminOptions(options),
  });
}
