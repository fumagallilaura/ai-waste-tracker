"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/units";
import { Plus, Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface Production {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  convidados: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Calendar; color: string }> = {
  planejado: { label: "Planejado", icon: Calendar, color: "text-info-600 dark:text-info-400" },
  em_andamento: { label: "Em andamento", icon: Clock, color: "text-warning-600 dark:text-warning-400" },
  finalizado: { label: "Finalizado", icon: CheckCircle, color: "text-primary-600 dark:text-primary-400" },
};

export default function ProductionsPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<Production[]>("/productions", token)
      .then(setProductions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Produções</h1>
          <p className="text-text-secondary mt-1">
            Eventos e turnos de operação.
          </p>
        </div>
        <Link
          href="/productions/new"
          className="flex items-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova produção
        </Link>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {productions.length === 0 ? (
        <div className="bg-bg-surface rounded-xl border border-border-default p-12 text-center">
          <p className="text-text-muted text-lg mb-4">Nenhuma produção cadastrada</p>
          <Link
            href="/productions/new"
            className="inline-flex items-center gap-2 bg-primary-600 text-text-inverse px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar primeira produção
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {productions.map((prod) => {
            const statusCfg = STATUS_CONFIG[prod.status] || STATUS_CONFIG.planejado;
            const StatusIcon = statusCfg.icon;
            const date = new Date(prod.data);

            return (
              <Link
                key={prod.id}
                href={
                  prod.status === "finalizado"
                    ? `/productions/${prod.id}?tab=balanco`
                    : `/productions/${prod.id}?tab=requisicao`
                }
                className="bg-bg-surface rounded-xl border border-border-default p-6 hover:border-primary-300 dark:hover:border-primary-700 transition-colors block"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-text-primary">{prod.nome}</h3>
                      <span className={`text-xs flex items-center gap-1 ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {date.toLocaleDateString("pt-BR")}
                      </span>
                      {prod.convidados && (
                        <span>{prod.convidados} convidados</span>
                      )}
                      <span className="capitalize">{prod.tipo.replace("_", " ")}</span>
                    </div>
                  </div>

                  <span
                    className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-lg border ${
                      prod.status === "finalizado"
                        ? "border-border-default text-text-secondary"
                        : "border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400"
                    }`}
                  >
                    {prod.status === "finalizado"
                      ? "Ver balanço →"
                      : "Ver requisição →"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
