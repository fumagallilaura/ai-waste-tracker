/** Authentication utilities. */

import { apiPost } from "./api";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  plan: "free" | "pro";
  plan_expires_at: string | null;
  created_at: string;
}

const TOKEN_KEY = "dz_access_token";
const REFRESH_KEY = "dz_refresh_token";

export function saveTokens(tokens: Tokens): void {
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function login(email: string, password: string): Promise<Tokens> {
  const tokens = await apiPost<Tokens>("/auth/login", { email, password });
  saveTokens(tokens);
  return tokens;
}

export async function register(email: string, password: string): Promise<Tokens> {
  const tokens = await apiPost<Tokens>("/auth/register", { email, password });
  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(): Promise<Tokens | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const tokens = await apiPost<Tokens>("/auth/refresh", { refresh_token: refreshToken });
    saveTokens(tokens);
    return tokens;
  } catch {
    clearTokens();
    return null;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiPost("/auth/logout", { refresh_token: refreshToken });
    } catch {
      // Ignore errors on logout
    }
  }
  clearTokens();
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const { apiGet } = await import("./api");
    return await apiGet<User>("/auth/me", token);
  } catch {
    // Try to refresh
    const newTokens = await refreshAccessToken();
    if (!newTokens) return null;

    try {
      const { apiGet } = await import("./api");
      return await apiGet<User>("/auth/me", newTokens.access_token);
    } catch {
      return null;
    }
  }
}
