"use client";

import { useState } from "react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { apiGet, apiPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Sun, Moon, Monitor, Download, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError("Não autenticado");
      setExporting(false);
      return;
    }

    try {
      const data = await apiGet<Record<string, unknown>>("/lgpd/export", token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `desperdicio-zero-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar dados");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETAR MINHA CONTA") {
      setError('Digite "DELETAR MINHA CONTA" para confirmar');
      return;
    }

    setDeleting(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError("Não autenticado");
      setDeleting(false);
      return;
    }

    try {
      await apiPost("/lgpd/delete-account", {}, token);
      // Clear local data
      localStorage.clear();
      // Redirect to home
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar conta");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configurações</h1>
        <p className="text-text-secondary mt-1">
          Personalize sua experiência e gerencie seus dados.
        </p>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {/* Appearance */}
      <section className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Aparência</h2>
        <p className="text-sm text-text-muted">
          Escolha como o app aparece na sua tela.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                ${
                  theme === value
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-border-default hover:border-border-strong"
                }
              `}
            >
              <Icon
                className={`w-6 h-6 ${
                  theme === value
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-text-muted"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  theme === value
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-text-secondary"
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 p-4 rounded-lg bg-bg-surface-alt border border-border-default">
          <p className="text-sm text-text-muted mb-2">Pré-visualização:</p>
          <div
            className={`
              rounded-lg p-4 border transition-colors
              ${
                resolvedTheme === "dark"
                  ? "bg-bg-primary border-border-default"
                  : "bg-bg-warm border-border-default"
              }
            `}
          >
            <p className="text-text-primary font-medium">Tema atual: {resolvedTheme === "dark" ? "Escuro" : "Claro"}</p>
            <p className="text-text-secondary text-sm mt-1">
              {theme === "system"
                ? "Seguindo preferência do sistema"
                : `Selecionado manualmente`}
            </p>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Conta</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border-default">
            <span className="text-text-secondary text-sm">Plano atual</span>
            <span className="text-text-primary font-medium text-sm">Grátis</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-text-secondary text-sm">Eventos este mês</span>
            <span className="text-text-primary font-medium text-sm">0 / 1</span>
          </div>
        </div>
        <Link
          href="/upgrade"
          className="block w-full text-center bg-primary-600 text-text-inverse py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Upgrade para Pro — R$19,90/mês
        </Link>
      </section>

      {/* Data & Privacy (LGPD) */}
      <section className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Dados e Privacidade</h2>
        <p className="text-sm text-text-muted">
          Em conformidade com a LGPD (Lei nº 13.709/2018).
        </p>

        <div className="space-y-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-between py-3 px-4 rounded-lg border border-border-default hover:border-primary-300 dark:hover:border-primary-700 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-text-muted" />
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">Exportar meus dados</p>
                <p className="text-xs text-text-muted">JSON com todas as suas informações</p>
              </div>
            </div>
            {exporting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            )}
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-lg border border-border-default hover:border-danger-300 dark:hover:border-danger-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-text-muted" />
                <div className="text-left">
                  <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
                    Deletar minha conta
                  </p>
                  <p className="text-xs text-text-muted">Remove todos os dados permanentemente</p>
                </div>
              </div>
            </button>
          ) : (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300">
                <AlertTriangle className="w-5 h-5" />
                <p className="text-sm font-medium">Esta ação é irreversível</p>
              </div>
              <p className="text-xs text-text-muted">
                Digite <strong>DELETAR MINHA CONTA</strong> para confirmar:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETAR MINHA CONTA"
                className="w-full px-3 py-2 border border-danger-300 dark:border-danger-700 rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-danger-500 focus:border-danger-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirm !== "DELETAR MINHA CONTA"}
                  className="flex-1 bg-danger-600 text-text-inverse py-2 rounded-lg text-sm font-medium hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? "Deletando..." : "Confirmar exclusão"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirm("");
                  }}
                  className="px-4 py-2 border border-border-default rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-text-muted">
          <Link href="/privacidade" className="text-primary-600 hover:underline">
            Política de Privacidade
          </Link>{" "}
          ·{" "}
          <Link href="/termos" className="text-primary-600 hover:underline">
            Termos de Uso
          </Link>
        </p>
      </section>
    </div>
  );
}
