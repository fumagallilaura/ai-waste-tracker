/** API client: refresh automático de sessão + fila offline para mutações. */

import { enqueue } from "./offline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const TOKEN_KEY = "dz_access_token";
const REFRESH_KEY = "dz_refresh_token";

export const OFFLINE_QUEUED_MESSAGE =
  "Sem internet: sua alteração foi salva no dispositivo e será enviada quando a conexão voltar.";

interface FetchOptions extends RequestInit {
  retry?: number;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function clearAuth(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

function redirectToLogin(): void {
  clearAuth();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?expired=1";
  }
}

let refreshPromise: Promise<boolean> | null = null;

/** Renova o access token uma vez (lock compartilhado entre chamadas concorrentes). */
async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        clearAuth();
        return false;
      }
      const tokens = await response.json();
      window.localStorage.setItem(TOKEN_KEY, tokens.access_token);
      window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function rawFetch(url: string, options: FetchOptions, authed: boolean): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (authed && token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${url}`, { ...options, headers, credentials: "include" });
  } catch (error) {
    // falha de rede (offline)
    if (authed && options.method && options.method !== "GET") {
      const body = options.body ? JSON.parse(options.body as string) : undefined;
      await enqueue({ url, method: options.method as "POST", body, token: getToken() });
      throw new Error(OFFLINE_QUEUED_MESSAGE);
    }
    throw new Error("Você está sem internet. Conecte-se para carregar os dados.");
  }

  if (response.status === 401 && authed && !url.startsWith("/auth/")) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      redirectToLogin();
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    // tenta uma vez com o token novo
    const retryHeaders = { ...headers, Authorization: `Bearer ${getToken()}` };
    response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: retryHeaders,
      credentials: "include",
    });
    if (response.status === 401) {
      redirectToLogin();
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
  }

  return response;
}

async function parseOk<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    const detail = error.detail;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (response.status === 204) return {} as T;
  return response.json();
}

// `_token` mantém compatibilidade com chamadas antigas; o token real vem do localStorage.
export async function apiGet<T>(url: string, _token?: string): Promise<T> {
  const response = await rawFetch(url, {}, true);
  return parseOk<T>(response);
}

export async function apiPost<T>(url: string, body: unknown, _token?: string): Promise<T> {
  const response = await rawFetch(url, { method: "POST", body: JSON.stringify(body) }, true);
  return parseOk<T>(response);
}

export async function apiPut<T>(url: string, body: unknown, _token?: string): Promise<T> {
  const response = await rawFetch(url, { method: "PUT", body: JSON.stringify(body) }, true);
  return parseOk<T>(response);
}

export async function apiDelete(url: string, _token?: string): Promise<void> {
  const response = await rawFetch(url, { method: "DELETE" }, true);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    const detail = error.detail;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

/** Chamadas públicas (sem Authorization) — usadas no fluxo de visitante e auth. */
export async function publicGet<T>(url: string): Promise<T> {
  const response = await rawFetch(url, {}, false);
  return parseOk<T>(response);
}

export async function publicPost<T>(url: string, body: unknown): Promise<T> {
  const response = await rawFetch(
    url,
    { method: "POST", body: JSON.stringify(body) },
    false
  );
  return parseOk<T>(response);
}
