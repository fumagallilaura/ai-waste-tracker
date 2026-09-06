/** Rascunhos: o que a pessoa começou a preencher fica salvo no navegador. */

const PREFIX = "dz_draft_";

export interface Draft<T> {
  data: T;
  updatedAt: number;
}

export const DRAFT_KEYS = {
  producao: `${PREFIX}producao`,
  receita: `${PREFIX}receita`,
} as const;

export function loadDraft<T>(key: string): Draft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Draft<T>;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    key,
    JSON.stringify({ data, updatedAt: Date.now() } satisfies Draft<T>)
  );
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function formatDraftAge(updatedAt: number): string {
  const minutes = Math.floor((Date.now() - updatedAt) / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}
