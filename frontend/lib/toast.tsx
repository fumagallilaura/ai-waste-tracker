"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type ToastKind = "info" | "error" | "success";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener([...toasts]);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, kind: ToastKind = "info"): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => dismiss(id), 4000);
}

export function toastError(message: string): void {
  toast(message, "error");
}

export function toastSuccess(message: string): void {
  toast(message, "success");
}

export function Toaster() {
  const [state, setState] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  if (state.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {state.map((t) => {
        const styles =
          t.kind === "error"
            ? "bg-danger-50 dark:bg-danger-900/40 border-danger-300 dark:border-danger-700 text-danger-800 dark:text-danger-200"
            : t.kind === "success"
            ? "bg-primary-50 dark:bg-primary-900/40 border-primary-300 dark:border-primary-700 text-primary-800 dark:text-primary-200"
            : "bg-bg-surface border-border-default text-text-primary";
        const Icon = t.kind === "error" ? AlertCircle : t.kind === "success" ? CheckCircle : Info;
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-sm shadow-lg ${styles}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
