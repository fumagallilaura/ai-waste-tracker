"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/units";

interface Metrics {
  total_compras: number;
  desperdicio_total: number;
  taxa_desperdicio: number;
  eventos_realizados: number;
  desperdicio_medio_por_evento: number;
  periodo: string;
}

interface HistoryItem {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  status: string;
  cliente: string | null;
  custo_compras: number;
  custo_desperdicio: number;
  consumo_total: number;
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
          Quanto você comprou, quanto virou descarte e o que cada evento consome.
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
          <p className="text-sm text-text-muted">Requisições do período</p>
          <p data-testid="metric-compras" className="text-3xl font-bold text-text-primary mt-2">
            {formatCurrency(metrics?.total_compras ?? 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {metrics && metrics.eventos_realizados > 0
              ? `${metrics.eventos_realizados} evento(s) finalizado(s)`
              : "Registre sua primeira produção"}
          </p>
        </div>

        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Descartado este mês</p>
          <p data-testid="metric-desperdicio" className="text-3xl font-bold text-danger-600 dark:text-danger-400 mt-2">
            {formatCurrency(metrics?.desperdicio_total ?? 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {metrics && metrics.eventos_realizados > 0
              ? `Média ${formatCurrency(metrics.desperdicio_medio_por_evento)} por evento`
              : "Registre o balanço no fim de cada evento"}
          </p>
        </div>

        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Taxa de desperdício</p>
          <p data-testid="metric-taxa" className="text-3xl font-bold text-warning-600 dark:text-warning-400 mt-2">
            {(metrics?.taxa_desperdicio ?? 0).toLocaleString("pt-BR")}%
          </p>
          <p className="text-xs text-text-muted mt-1">
            Descartado sobre o valor requisitado
          </p>
        </div>
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden">
          <div className="px-6 py-4 border-b border-border-default">
            <h2 className="text-lg font-semibold text-text-primary">Produções recentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium text-right">Requisição</th>
                  <th className="px-6 py-3 font-medium text-right">Descartado</th>
                  <th className="px-6 py-3 font-medium text-right">Consumido</th>
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
                    <td className="px-6 py-3 text-text-secondary">{item.cliente ?? "—"}</td>
                    <td className="px-6 py-3 text-text-secondary">
                      {new Date(item.data).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-3 text-right text-text-primary">
                      {formatCurrency(item.custo_compras)}
                    </td>
                    <td className="px-6 py-3 text-right text-danger-600 dark:text-danger-400">
                      {formatCurrency(item.custo_desperdicio)}
                    </td>
                    <td className="px-6 py-3 text-right text-text-secondary">
                      {item.consumo_total.toLocaleString("pt-BR")}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comece por aqui: o fluxo do app em 3 passos */}
      {history.length === 0 && (
        <div className="bg-bg-surface rounded-xl p-8 border border-border-default">
          <h2 className="text-xl font-semibold text-text-primary mb-1">Comece por aqui</h2>
          <p className="text-text-secondary text-sm mb-6">
            Três passos para parar de desperdiçar:
          </p>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              {
                n: 1,
                titulo: "Cadastre suas receitas",
                descricao:
                  "Ingredientes, rendimento e preço por kg/L/un. Vale importar da internet também.",
                href: "/recipes/new",
                cta: "Cadastrar receita",
              },
              {
                n: 2,
                titulo: "Crie a produção do evento",
                descricao:
                  "Informe quantas receitas vai fazer — a lista para requisição sai pronta, descontando o estoque.",
                href: "/productions/new",
                cta: "Criar produção",
              },
              {
                n: 3,
                titulo: "Registre o balanço no fim",
                descricao:
                  "Quanto foi consumido, descartado (exposto) e devolvido (não exposto). O app aprende o padrão.",
                href: "/productions",
                cta: "Ver produções",
              },
            ].map(({ n, titulo, descricao, href, cta }) => (
              <li key={n} className="rounded-lg border border-border-default p-4 flex flex-col">
                <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-semibold flex items-center justify-center mb-3">
                  {n}
                </span>
                <p className="font-medium text-text-primary text-sm">{titulo}</p>
                <p className="text-text-muted text-xs mt-1 mb-4 flex-1">{descricao}</p>
                <Link
                  href={href}
                  className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline"
                >
                  {cta} →
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
