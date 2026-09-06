"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/units";
import { BarChart3, TrendingDown, Lightbulb, Store, PartyPopper } from "lucide-react";

interface EventInsight {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  convidados: number | null;
  consumo_pct: number;
  descarte_pct: number;
  custo_desperdicio: number;
  vs_media_consumo: number;
  vs_media_descarte: number;
}

interface EventsResponse {
  eventos: EventInsight[];
  resumo: { eventos_analisados: number; media_consumo_pct: number; media_descarte_pct: number } | null;
  sugestoes: string[];
}

interface DailyDay {
  dia: string;
  eventos: number;
  media_produzida: number;
  media_consumida: number;
  sobrou_pct: number;
  esgotou_pct: number;
  producao_sugerida: number;
}

interface DailyItem {
  item: string;
  unidade_base: string;
  dias: DailyDay[];
}

interface DailyResponse {
  dias_analisados: number;
  itens: DailyItem[];
  sugestoes: string[];
}

const PERIODOS = [
  { value: "mes_atual", label: "Este mês" },
  { value: "ultimos_30_dias", label: "Últimos 30 dias" },
  { value: "ultimos_90_dias", label: "Últimos 90 dias" },
];

export default function AnalisesPage() {
  const [tab, setTab] = useState<"eventos" | "comercio">("eventos");
  const [periodo, setPeriodo] = useState("ultimos_30_dias");
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    const calls =
      tab === "eventos"
        ? [apiGet<EventsResponse>(`/insights/events?periodo=${periodo}`, token).then(setEvents)]
        : [apiGet<DailyResponse>(`/insights/daily?periodo=${periodo}`, token).then(setDaily)];
    Promise.all(calls)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar análises"))
      .finally(() => setLoading(false));
  }, [tab, periodo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Análises</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Compare seus eventos, entenda seu padrão e perca menos dinheiro.
          </p>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          data-testid="analises-periodo"
          className="px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-bg-surface-alt rounded-lg p-1">
        {[
          { key: "eventos" as const, label: "Eventos", icon: PartyPopper },
          { key: "comercio" as const, label: "Dia a dia (comércio)", icon: Store },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {!loading && tab === "eventos" && events && <EventosTab data={events} />}
      {!loading && tab === "comercio" && daily && <ComercioTab data={daily} />}
    </div>
  );
}

function SuggestionCard({ sugestoes }: { sugestoes: string[] }) {
  if (sugestoes.length === 0) return null;
  return (
    <div
      data-testid="sugestoes"
      className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-5 space-y-3"
    >
      <h3 className="font-semibold text-primary-800 dark:text-primary-300 flex items-center gap-2 text-sm">
        <Lightbulb className="w-4 h-4" />
        Ajuda inteligente — como desperdiçar menos
      </h3>
      <ul className="space-y-2">
        {sugestoes.map((s, i) => (
          <li key={i} className="text-sm text-primary-900 dark:text-primary-200 list-disc list-inside">
            {s}
          </li>
        ))}
      </ul>
      <p className="text-xs text-primary-700 dark:text-primary-400">
        Sugestões calculadas a partir do seu histórico. Em breve: análise conversacional com IA.
      </p>
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: "green" | "red" }) {
  const width = Math.min(100, Math.max(2, pct));
  const barColor =
    color === "green"
      ? "bg-primary-500 dark:bg-primary-400"
      : "bg-danger-500 dark:bg-danger-400";
  return (
    <div className="h-2.5 rounded-full bg-bg-surface-alt overflow-hidden">
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function EventosTab({ data }: { data: EventsResponse }) {
  if (!data.resumo) {
    return (
      <div className="bg-bg-surface rounded-xl border border-border-default p-10 text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-text-muted mb-3" />
        <p className="text-text-muted text-sm">
          Nenhum evento finalizado com balanço neste período.
        </p>
        <p className="text-text-muted text-xs mt-1">
          Registre o balanço no fim dos eventos para ver as comparações aqui.
        </p>
      </div>
    );
  }

  const { resumo, eventos } = data;
  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-xs text-text-muted">Eventos analisados</p>
          <p data-testid="resumo-eventos" className="text-2xl font-bold text-text-primary mt-1">
            {resumo.eventos_analisados}
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-xs text-text-muted">Consumo médio</p>
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
            {resumo.media_consumo_pct.toLocaleString("pt-BR")}%
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-xs text-text-muted">Descarte médio</p>
          <p className="text-2xl font-bold text-danger-600 dark:text-danger-400 mt-1">
            {resumo.media_descarte_pct.toLocaleString("pt-BR")}%
          </p>
        </div>
      </div>

      <SuggestionCard sugestoes={data.sugestoes} />

      {/* Comparação por evento */}
      <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">Cada evento vs. sua média</h3>
        {eventos.map((e) => (
          <Link
            key={e.id}
            href={`/productions/${e.id}?tab=balanco`}
            className="block p-4 rounded-lg border border-border-default hover:border-primary-300 dark:hover:border-primary-700 transition-colors space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">
                {e.nome}
                <span className="text-text-muted font-normal"> · {new Date(e.data).toLocaleDateString("pt-BR")}</span>
              </p>
              <span className="text-xs text-text-muted whitespace-nowrap">
                {formatCurrency(e.custo_desperdicio)} descartados
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
              <span className="text-text-muted w-20">Consumido</span>
              <Bar pct={e.consumo_pct} color="green" />
              <span
                className={`w-16 text-right font-medium ${
                  e.vs_media_consumo >= 0
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-warning-600 dark:text-warning-400"
                }`}
              >
                {e.consumo_pct.toLocaleString("pt-BR")}%
                {e.vs_media_consumo !== 0 &&
                  ` (${e.vs_media_consumo > 0 ? "+" : ""}${e.vs_media_consumo.toLocaleString("pt-BR")})`}
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
              <span className="text-text-muted w-20">Descartado</span>
              <Bar pct={e.descarte_pct} color="red" />
              <span
                className={`w-16 text-right font-medium ${
                  e.vs_media_descarte > 0
                    ? "text-danger-600 dark:text-danger-400"
                    : "text-primary-600 dark:text-primary-400"
                }`}
              >
                {e.descarte_pct.toLocaleString("pt-BR")}%
                {e.vs_media_descarte !== 0 &&
                  ` (${e.vs_media_descarte > 0 ? "+" : ""}${e.vs_media_descarte.toLocaleString("pt-BR")})`}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ComercioTab({ data }: { data: DailyResponse }) {
  if (data.itens.length === 0) {
    return (
      <div className="bg-bg-surface rounded-xl border border-border-default p-10 text-center">
        <Store className="w-12 h-12 mx-auto text-text-muted mb-3" />
        <p className="text-text-muted text-sm">
          Nenhum turno registrado neste período.
        </p>
        <p className="text-text-muted text-xs mt-1">
          Crie produções do tipo <strong>Turno diário</strong> e registre o balanço — o app
          aprende o padrão por dia da semana e sugere quanto produzir.
        </p>
        <Link
          href="/productions/new"
          className="inline-block mt-4 bg-primary-600 text-text-inverse px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Registrar turno
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SuggestionCard sugestoes={data.sugestoes} />

      {data.itens.map((item) => (
        <div
          key={item.item}
          className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">{item.item}</h3>
            <span className="text-xs text-text-muted">por dia da semana</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-text-muted text-xs">
                  <th className="py-2 pr-3 font-medium">Dia</th>
                  <th className="py-2 pr-3 font-medium text-right">Produziu</th>
                  <th className="py-2 pr-3 font-medium text-right">Consumiu</th>
                  <th className="py-2 pr-3 font-medium text-right">Sobrou</th>
                  <th className="py-2 pr-3 font-medium text-right">Esgotou</th>
                  <th className="py-2 font-medium text-right">Sugestão</th>
                </tr>
              </thead>
              <tbody>
                {item.dias.map((d) => (
                  <tr key={d.dia} className="border-t border-border-default">
                    <td className="py-2.5 pr-3 capitalize text-text-primary font-medium">{d.dia}</td>
                    <td className="py-2.5 pr-3 text-right text-text-secondary">
                      {d.media_produzida.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-text-secondary">
                      {d.media_consumida.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className={d.sobrou_pct >= 25 ? "text-danger-600 dark:text-danger-400 font-medium" : "text-text-secondary"}>
                        {d.sobrou_pct.toLocaleString("pt-BR")}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className={d.esgotou_pct >= 50 ? "text-warning-600 dark:text-warning-400 font-medium" : "text-text-secondary"}>
                        {d.esgotou_pct.toLocaleString("pt-BR")}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {d.producao_sugerida.toLocaleString("pt-BR")} {item.unidade_base}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p className="text-xs text-text-muted">
        Sugestão = consumo médio do dia, aumentado quando o item esgota (venda perdida) e
        reduzido quando sobra. Quanto mais turnos registrados, mais precisa a análise.
      </p>
    </div>
  );
}
