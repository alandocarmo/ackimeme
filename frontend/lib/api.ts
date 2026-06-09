import { io, Socket } from "socket.io-client";
import { AppConfig, Launch, Trade, CommentType, Holder, Session } from "../types";

function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export const API_BASE_URL = resolveApiBaseUrl();

let _socket: Socket | null = null;
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!_socket) {
    _socket = io(API_BASE_URL, { withCredentials: true });
  }
  return _socket;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  adminToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
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

    const isJson = response.headers.get("content-type")?.includes("application/json");
    let data: unknown = null;
    try {
      data = isJson ? await response.json() : null;
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      throw new Error((data as Record<string, string>)?.error || `error_http_${response.status}`);
    }

    return data as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('error_timeout');
    }
    throw err;
  }
}

export function getConfig(): Promise<AppConfig> {
  return request<AppConfig>("/config");
}

export function createAuthChallenge(walletAddress: string): Promise<{ challenge: { id: string; message: string } }> {
  return request<{ challenge: { id: string; message: string } }>("/auth/challenge", {
    method: "POST",
    body: { walletAddress },
  });
}

export function verifyAuthChallenge(payload: { walletAddress: string; signature: string; challengeId?: string; publicKey?: string }): Promise<{ success: boolean; session: Session }> {
  return request<{ success: boolean; session: Session }>("/auth/verify", {
    method: "POST",
    body: payload,
  });
}

export function getSession(token?: string): Promise<{ session: Session }> {
  return request<{ session: Session }>("/auth/session", { token });
}

export function logout(token?: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/auth/logout", {
    method: "POST",
    token,
  });
}

export function verifyPayment(payload: { txHash: string; launchId?: string; walletAddress?: string; tokenSymbol?: string; isBoosted?: boolean }): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/verify-payment", {
    method: "POST",
    body: payload,
  });
}

interface LaunchPayload {
  name: string;
  symbol: string;
  description: string;
  tagline: string;
  logoUrl?: string;
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
  totalSupply?: string;
  creatorWallet?: string;
  pumpForever?: boolean;
  slopeDivisor?: number;
  initialReserve?: string;
  creatorFeeBps?: number;
  paymentAmount?: string;
  txHash: string;
  tokenSymbol?: string;
  isBoosted?: boolean;
}

export function createLaunchRequest(payload: LaunchPayload, token?: string): Promise<{ success: boolean; launchId?: string; launchRequest?: unknown }> {
  return request<{ success: boolean; launchId?: string; launchRequest?: unknown }>("/launch-request", {
    method: "POST",
    body: payload,
    token,
    timeoutMs: 90000,
  });
}

export function getMyLaunches(token?: string): Promise<Launch[]> {
  return request<Launch[]>("/launches/my", { token });
}

export function getPublicLaunches(): Promise<{ launches: Launch[] }> {
  return request<{ launches: Launch[] }>("/public/launches");
}

export function getLaunchById(id: string): Promise<Launch> {
  return request<Launch>(`/launches/${encodeURIComponent(id)}`);
}

export function unlockAdmin(password: string, walletAddress: string): Promise<{ success: boolean; token: string }> {
  return request<{ success: boolean; token: string }>("/admin/unlock", {
    method: "POST",
    body: { password, walletAddress },
  });
}

export function getSecurityAnomalies(): Promise<{ anomalies: Array<{ id: string; type: string; severity: string; details: string }> }> {
  return request<{ anomalies: Array<{ id: string; type: string; severity: string; details: string }> }>("/admin/security/anomalies");
}

// ─── QR Code Auth Endpoints ──────────────────────────────────────────────────

export function generateQrChallenge(): Promise<{ sessionId: string; authUrl: string }> {
  return request<{ sessionId: string; authUrl: string }>("/auth/qr/generate", {
    method: "POST",
  });
}

export function getQrStatus(sessionId: string): Promise<{ status: string; token?: string; user?: Session }> {
  return request<{ status: string; token?: string; user?: Session }>(`/auth/qr/status/${encodeURIComponent(sessionId)}`);
}

// ─── Comments API ────────────────────────────────────────────────────────────

export function getComments(launchId: string): Promise<{ comments: CommentType[] }> {
  return request<{ comments: CommentType[] }>(`/launches/${encodeURIComponent(launchId)}/comments`);
}

export function postComment(launchId: string, content: string): Promise<{ comment: CommentType }> {
  return request<{ comment: CommentType }>(`/launches/${encodeURIComponent(launchId)}/comments`, {
    method: "POST",
    body: { content },
  });
}

// ─── Wallet API ──────────────────────────────────────────────────────────────

export function getWalletBalance(address: string): Promise<{ success: boolean; shellEccBalance: number }> {
  return request<{ success: boolean; shellEccBalance: number }>(`/wallet/${encodeURIComponent(address)}/balance`);
}

export function getTrades(launchId: string, limit = 50): Promise<{ trades: Trade[] }> {
  return request<{ trades: Trade[] }>(`/launches/${encodeURIComponent(launchId)}/trades?limit=${limit}`);
}

export function getHolders(launchId: string): Promise<{ holders: Holder[]; totalSupply: number }> {
  return request<{ holders: Holder[]; totalSupply: number }>(`/launches/${encodeURIComponent(launchId)}/holders`);
}

// ─── Improvements API ────────────────────────────────────────────────────────

export function searchLaunches(q: string): Promise<{ launches: Launch[] }> {
  return request<{ launches: Launch[] }>(`/launches/search?q=${encodeURIComponent(q)}`);
}

export function addFavorite(launchId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/launches/${encodeURIComponent(launchId)}/favorite`, {
    method: "POST",
  });
}

export function removeFavorite(launchId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/launches/${encodeURIComponent(launchId)}/favorite`, {
    method: "DELETE",
  });
}

export function getFavorites(): Promise<{ launches: Launch[] }> {
  return request<{ launches: Launch[] }>("/launches/my/favorites");
}

export function getPriceHistory(launchId: string, interval = 15): Promise<{ history: Record<string, unknown>[] }> {
  return request<{ history: Record<string, unknown>[] }>(`/launches/${encodeURIComponent(launchId)}/price-history?interval=${interval}`);
}

export function getGlobalStats(): Promise<{ stats: { volume24h: number; activeTraders: number; totalLaunches: number } }> {
  return request<{ stats: { volume24h: number; activeTraders: number; totalLaunches: number } }>("/stats");
}
