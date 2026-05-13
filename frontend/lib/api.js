import { io } from "socket.io-client";

function resolveApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export const API_BASE_URL = resolveApiBaseUrl();

// Socket.io initialization
export const socket = typeof window !== "undefined" 
  ? io(API_BASE_URL, { withCredentials: true })
  : null;

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.adminToken ? { "X-Admin-Token": options.adminToken } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      credentials: "include", // Required for HttpOnly cookies
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('A requisição demorou muito e foi cancelada.');
    }
    throw err;
  }
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
    timeoutMs: 90000, // Deploy can take longer
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

export function getSecurityAnomalies() {
  return request("/admin/security/anomalies");
}

export function verifyShellBuyPayment(payload) {
  return request("/shell-buy/verify", {
    method: "POST",
    body: payload,
  });
}

export function getMyShellBuyOrders() {
  return request("/shell-buy/my-orders");
}

// ─── QR Code Auth Endpoints ──────────────────────────────────────────────────

export function generateQrChallenge() {
  return request("/auth/qr/generate", {
    method: "POST",
  });
}

export function getQrStatus(sessionId) {
  return request(`/auth/qr/status/${encodeURIComponent(sessionId)}`);
}

// Removed simulateQrWebhook as it sends mocked keys which is invalid in production.

// ─── Comments API ────────────────────────────────────────────────────────────

export function getComments(launchId) {
  return request(`/launches/${encodeURIComponent(launchId)}/comments`);
}

export function postComment(launchId, content) {
  return request(`/launches/${encodeURIComponent(launchId)}/comments`, {
    method: "POST",
    body: { content },
  });
}

// ─── Wallet API ──────────────────────────────────────────────────────────────

export function getWalletBalance(address) {
  return request(`/wallet/${encodeURIComponent(address)}/balance`);
}

export function getTrades(launchId, limit = 50) {
  return request(`/launches/${encodeURIComponent(launchId)}/trades?limit=${limit}`);
}

export function getHolders(launchId) {
  return request(`/launches/${encodeURIComponent(launchId)}/holders`);
}
