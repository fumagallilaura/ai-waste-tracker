/** Fila offline: guarda mutações sem internet e envia quando a conexão volta. */

import { get as idbGet, set as idbSet } from "idb-keyval";

const OUTBOX_KEY = "dz_outbox";

export interface OutboxItem {
  id: string;
  url: string;
  method: "POST" | "PUT" | "DELETE";
  body?: unknown;
  token: string | null;
  createdAt: number;
}

const listeners = new Set<(pending: number) => void>();

function notify(pending: number): void {
  listeners.forEach((fn) => fn(pending));
}

export function onPendingChange(fn: (pending: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function pendingCount(): Promise<number> {
  const list = (await idbGet<OutboxItem[]>(OUTBOX_KEY)) ?? [];
  return list.length;
}

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt">): Promise<void> {
  const list = (await idbGet<OutboxItem[]>(OUTBOX_KEY)) ?? [];
  list.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now() });
  await idbSet(OUTBOX_KEY, list);
  notify(list.length);
}

/** Reenvia a fila em ordem. Para na primeira falha de rede ou 401 (precisa login). */
export async function flushOutbox(): Promise<number> {
  const list = (await idbGet<OutboxItem[]>(OUTBOX_KEY)) ?? [];
  if (list.length === 0) return 0;

  const remaining: OutboxItem[] = [];
  let synced = 0;

  for (const item of list) {
    try {
      const response = await fetch(`${API_BASE_URL}${item.url}`, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(item.token ? { Authorization: `Bearer ${item.token}` } : {}),
        },
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        credentials: "include",
      });
      if (response.status === 401 || response.status === 403) {
        // sem permissão (ex.: sessão expirou) — para; tenta de novo após novo login
        remaining.push(...list.slice(list.indexOf(item)));
        break;
      }
      if (!response.ok) {
        // erro definitivo do servidor — descarta para não travar a fila
        synced++;
        continue;
      }
      synced++;
    } catch {
      // ainda sem internet — mantém este e o restante
      remaining.push(...list.slice(list.indexOf(item)));
      break;
    }
  }

  await idbSet(OUTBOX_KEY, remaining);
  notify(remaining.length);
  return synced;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
