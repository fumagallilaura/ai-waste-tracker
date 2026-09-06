"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { publicGet, publicPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency, getDisplayUnit } from "@/lib/units";
import { ArrowLeft, ShoppingCart, AlertTriangle, UserPlus, CheckCircle2 } from "lucide-react";

interface GuestProduction {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  convidados: number | null;
  status: string;
  recipes: { id: string; item_nome: string | null; escala_fator: number }[];
  shopping_list: {
    id: string;
    ingrediente: string;
    quantidade_total: number;
    unidade_base: string;
    quantidade_a_comprar: number;
    preco_estimado: number;
  }[];
  waste_records: {
    id: string;
    item: string;
    quantidade_produzida: number;
    quantidade_consumida: number;
    quantidade_descartada: number;
    quantidade_devolvida: number;
    unidade: string;
    custo_desperdicio: number;
  }[];
}

const UNIDADES = ["g", "kg", "ml", "L", "unidade"];

export default function GuestProductionPage() {
  const params = useParams();
  const id = params.id as string;
  const [production, setProduction] = useState<GuestProduction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"shopping" | "waste">("shopping");

  const [balance, setBalance] = useState({
    item: "",
    quantidade_produzida: "",
    quantidade_consumida: "",
    quantidade_descartada: "",
    quantidade_devolvida: "",
    unidade: "unidade",
    custo_desperdicio: "",
  });
  const [savingBalance, setSavingBalance] = useState(false);

  useEffect(() => {
    publicGet<GuestProduction>(`/guest/productions/${id}`)
      .then(async (prod) => {
        if (prod.shopping_list.length === 0) {
          try {
            const items = await publicGet<GuestProduction["shopping_list"]>(
              `/guest/productions/${id}/shopping-list`
            );
            setProduction({ ...prod, shopping_list: items });
            return;
          } catch {
            /* mostra sem lista */
          }
        }
        setProduction(prod);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const handleBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balance.item.trim()) {
      setError("Informe o item");
      return;
    }
    setSavingBalance(true);
    setError(null);
    try {
      const record = await publicPost<GuestProduction["waste_records"][number]>(
        `/guest/productions/${id}/waste`,
        {
          item: balance.item.trim(),
          quantidade_produzida: parseFloat(balance.quantidade_produzida) || 0,
          quantidade_consumida: parseFloat(balance.quantidade_consumida) || 0,
          quantidade_descartada: parseFloat(balance.quantidade_descartada) || 0,
          quantidade_devolvida: parseFloat(balance.quantidade_devolvida) || 0,
          unidade: balance.unidade,
          custo_desperdicio: parseFloat(balance.custo_desperdicio) || 0,
        }
      );
      setProduction((prev) =>
        prev
          ? {
              ...prev,
              status: "finalizado",
              waste_records: [...prev.waste_records, record],
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar balanço");
    } finally {
      setSavingBalance(false);
    }
  };

  if (error && !production) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-text-muted">{error}</p>
        <Link href="/comecar" className="text-primary-600 hover:underline mt-2 inline-block">
          ← Voltar
        </Link>
      </div>
    );
  }

  if (!production) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totalRequisicao = production.shopping_list.reduce(
    (sum, i) => sum + i.preco_estimado,
    0
  );
  const totalDescarte = production.waste_records.reduce(
    (sum, r) => sum + r.custo_desperdicio,
    0
  );

  const fmtBase = (qtd: number, unit: string) => {
    const [v, u] = getDisplayUnit(qtd, unit);
    return `${v.toLocaleString("pt-BR")} ${u}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/comecar" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{production.nome}</h1>
          <p className="text-text-secondary text-sm mt-1">
            {new Date(production.data).toLocaleDateString("pt-BR")}
            {production.convidados && ` · ${production.convidados} convidados`}
          </p>
        </div>
      </div>

      {/* CTA cadastro — a produção dele vira da conta */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 text-sm text-primary-800 dark:text-primary-300">
          <strong>Quer salvar esta produção?</strong> Ao criar sua conta (grátis),
          ela passa a ser sua automaticamente — com histórico, receitas e estoque.
        </div>
        <Link
          href={getAccessToken() ? "/productions" : "/register"}
          data-testid="guest-cta"
          className="flex items-center justify-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          Criar conta grátis
        </Link>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Lista para comprar</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {formatCurrency(totalRequisicao)}
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Descartado (R$)</p>
          <p className="text-xl font-bold text-danger-600 dark:text-danger-400 mt-1">
            {formatCurrency(totalDescarte)}
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-bg-surface-alt rounded-lg p-1">
        {[
          { key: "shopping" as const, label: "Requisição", icon: ShoppingCart },
          { key: "waste" as const, label: "Balanço do evento", icon: AlertTriangle },
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

      {tab === "shopping" && (
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-2">
          {production.shopping_list.length === 0 ? (
            <p className="text-text-muted text-sm">Nenhum item na lista.</p>
          ) : (
            production.shopping_list.map((item) => {
              const [qtd, unit] = getDisplayUnit(item.quantidade_a_comprar, item.unidade_base);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border border-border-default"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.ingrediente}</p>
                    <p className="text-xs text-text-muted">
                      Necessário: {fmtBase(item.quantidade_total, item.unidade_base)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      Pedir: {qtd.toLocaleString("pt-BR")} {unit}
                    </p>
                    <p className="text-xs text-text-muted">{formatCurrency(item.preco_estimado)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "waste" && (
        <div className="space-y-6">
          {production.waste_records.length === 0 ? (
            <form
              onSubmit={handleBalance}
              className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4"
            >
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Balanço do evento</h2>
                <p className="text-sm text-text-muted mt-1">
                  No fim do evento, registre quanto foi consumido, descartado (estava
                  exposto) e quanto voltou (não exposto).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Item *</label>
                  <input
                    type="text"
                    value={balance.item}
                    onChange={(e) => setBalance((p) => ({ ...p, item: e.target.value }))}
                    placeholder="Ex: brigadeiro"
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Unidade</label>
                  <select
                    value={balance.unidade}
                    onChange={(e) => setBalance((p) => ({ ...p, unidade: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: "quantidade_produzida" as const, label: "Produzido" },
                  { field: "quantidade_consumida" as const, label: "Consumido" },
                  { field: "quantidade_descartada" as const, label: "Descartado (exposto)" },
                  { field: "quantidade_devolvida" as const, label: "Voltou (não exposto)" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={balance[field]}
                      onChange={(e) => setBalance((p) => ({ ...p, [field]: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                ))}
              </div>

              <div className="max-w-xs">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Custo do descartado (R$)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={balance.custo_desperdicio}
                  onChange={(e) => setBalance((p) => ({ ...p, custo_desperdicio: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingBalance}
                className="bg-primary-600 text-text-inverse px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
              >
                {savingBalance ? "Registrando..." : "Registrar balanço"}
              </button>
            </form>
          ) : (
            <div className="bg-bg-surface rounded-xl border border-primary-200 dark:border-primary-800 p-6 space-y-3">
              <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
                <CheckCircle2 className="w-5 h-5" />
                <p className="font-medium">Balanço registrado!</p>
              </div>
              {production.waste_records.map((r) => (
                <div key={r.id} className="text-sm text-text-secondary bg-bg-surface-alt rounded-lg p-3">
                  <p className="font-medium text-text-primary">{r.item}</p>
                  <p className="text-xs mt-1">
                    Consumido: {r.quantidade_consumida.toLocaleString("pt-BR")} {r.unidade} ·
                    Descartado: {r.quantidade_descartada.toLocaleString("pt-BR")} ·
                    Voltou: {r.quantidade_devolvida.toLocaleString("pt-BR")} ·
                    Descarte: {formatCurrency(r.custo_desperdicio)}
                  </p>
                </div>
              ))}
              <p className="text-sm text-text-muted">
                No modo visitante dá para registrar 1 balanço.{" "}
                <Link href="/register" className="text-primary-600 hover:underline">
                  Crie sua conta
                </Link>{" "}
                para acompanhar o padrão de consumo e gerenciar vários eventos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
