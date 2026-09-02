/** IndexedDB utilities for offline support. */

import { get, set, del, keys, clear } from "idb-keyval";

const DB_PREFIX = "dz_";

export interface PendingSync {
  id: string;
  type: "waste" | "production" | "recipe";
  data: Record<string, unknown>;
  created_at: string;
}

// ─── User Profile ─────────────────────────────────────────────

export async function saveUserProfile(profile: Record<string, unknown>): Promise<void> {
  await set(`${DB_PREFIX}user_profile`, profile);
}

export async function getUserProfile(): Promise<Record<string, unknown> | null> {
  return get(`${DB_PREFIX}user_profile`);
}

// ─── Recipes Cache ────────────────────────────────────────────

export async function cacheRecipes(recipes: unknown[]): Promise<void> {
  await set(`${DB_PREFIX}recipes`, recipes);
}

export async function getCachedRecipes(): Promise<unknown[] | null> {
  return get(`${DB_PREFIX}recipes`);
}

// ─── Productions Cache ────────────────────────────────────────

export async function cacheProductions(productions: unknown[]): Promise<void> {
  await set(`${DB_PREFIX}productions`, productions);
}

export async function getCachedProductions(): Promise<unknown[] | null> {
  return get(`${DB_PREFIX}productions`);
}

// ─── Pending Sync Queue ───────────────────────────────────────

export async function addPendingSync(sync: Omit<PendingSync, "id" | "created_at">): Promise<void> {
  const existing: PendingSync[] = (await get(`${DB_PREFIX}pending_sync`)) || [];
  const newSync: PendingSync = {
    ...sync,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  await set(`${DB_PREFIX}pending_sync`, [...existing, newSync]);
}

export async function getPendingSyncs(): Promise<PendingSync[]> {
  return get(`${DB_PREFIX}pending_sync`) || [];
}

export async function removePendingSync(id: string): Promise<void> {
  const existing: PendingSync[] = (await get(`${DB_PREFIX}pending_sync`)) || [];
  await set(
    `${DB_PREFIX}pending_sync`,
    existing.filter((s) => s.id !== id)
  );
}

export async function clearPendingSyncs(): Promise<void> {
  await del(`${DB_PREFIX}pending_sync`);
}

// ─── Last Sync Timestamp ──────────────────────────────────────

export async function setLastSync(timestamp: string): Promise<void> {
  await set(`${DB_PREFIX}last_sync`, timestamp);
}

export async function getLastSync(): Promise<string | null> {
  return get(`${DB_PREFIX}last_sync`);
}

// ─── Clear All Offline Data ───────────────────────────────────

export async function clearAllOfflineData(): Promise<void> {
  const allKeys = await keys();
  for (const key of allKeys) {
    if (typeof key === "string" && key.startsWith(DB_PREFIX)) {
      await del(key);
    }
  }
}
