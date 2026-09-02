"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/units";

interface Metrics {
  economia_total: number;
  desperdicio_total: number;
  eventos_realizados: number;
  desperdicio_medio_por_evento: number;
  economia_medio_por_evento: number;
  periodo: string;
}

interface HistoryItem {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  status: string;
  custo_compras: number;
  custo_desperdicio: number;
  economia: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<Metrics>("/dashboard/metrics", token)
      .then(setMetrics)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar métricas"));

    apiGet<HistoryItem[]>("/dashboard/history", token).then(setHistory).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">
          Acompanhe seu desperdício e economia.
        </p>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div data-testid="dashboard-metrics" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Desperdício este mês</p>
          <p data-testid="metric-desperdicio" className="text-3xl font-bold text-danger-600 dark:text-danger-400 mt-2">
            {formatCurrency(metrics?.desperdicio_total ?? 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {metrics && metrics.eventos_realizados > 0
              ? `Média ${formatCurrency(metrics.desperdicio_medio_por_evento)} por produção`
              : "Registre sua primeira produção"}
          </p>
        </div>

        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Economia estimada</p>
          <p data-testid="metric-economia" className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">
            {formatCurrency(metrics?.economia_total ?? 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">Baseado na média do mercado</p>
        </div>

        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Produções finalizadas</p>
          <p data-testid="metric-eventos" className="text-3xl font-bold text-text-primary mt-2">
            {metrics?.eventos_realizados ?? 0}
          </p>
          <p className="text-xs text-text-muted mt-1">Este mês</p>
        </div>
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden">
          <div className="px-6 py-4 border-b border-border-default">
            <h2 className="text-lg font-semibold text-text-primary">Produções recentes</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Desperdício</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-border-default hover:bg-bg-surface-alt transition-colors"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/productions/${item.id}`}
                      className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >
                      {item.nome}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {new Date(item.data).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === "finalizado"
                          ? "bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-300"
                          : "bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-danger-600 dark:text-danger-400">
                    {formatCurrency(item.custo_desperdicio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CTA */}
      {history.length === 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-8 text-center border border-primary-200 dark:border-primary-800">
          <h2 className="text-xl font-semibold text-primary-800 dark:text-primary-300 mb-2">
            Comece agora
          </h2>
          <p className="text-primary-700 dark:text-primary-400 mb-4">
            Cadastre sua primeira receita ou crie uma produção para ver seus números.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/recipes/new"
              className="bg-primary-600 text-text-inverse px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Cadastrar receita
            </Link>
            <Link
              href="/productions/new"
              className="bg-bg-surface text-primary-700 dark:text-primary-300 px-6 py-2 rounded-lg border border-primary-300 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              Criar produção
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
