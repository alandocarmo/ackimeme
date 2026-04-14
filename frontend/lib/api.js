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

export function getLaunchById(id) {
  return request(`/launches/${encodeURIComponent(id)}`);
}

export function unlockAdmin(password, walletAddress) {
  return request("/admin/unlock", {
    method: "POST",
    body: { password, walletAddress },
  });
}
