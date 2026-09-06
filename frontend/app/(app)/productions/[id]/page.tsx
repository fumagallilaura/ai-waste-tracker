"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency, getDisplayUnit } from "@/lib/units";
import { ArrowLeft, ShoppingCart, AlertTriangle, CheckCircle, Plus, Trash2, RotateCcw } from "lucide-react";

interface Production {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  convidados: number | null;
  client_id: string | null;
  status: string;
  recipes: { id: string; recipe_id: string | null; escala_fator: number; item_nome: string | null }[];
  shopping_list: {
    id: string;
    ingrediente: string;
    quantidade_total: number;
    unidade_base: string;
    quantidade_estoque: number;
    quantidade_a_comprar: number;
    preco_unitario: number;
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
    created_at: string;
  }[];
}

type Tab = "shopping" | "waste" | "details";

const UNIDADES = ["g", "kg", "ml", "L", "unidade"];

// useSearchParams exige boundary de Suspense no App Router
export default function ProductionDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    }>
      <ProductionDetailContent />
    </Suspense>
  );
}

function ProductionDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const requestedTab = searchParams.get("tab");
  const [production, setProduction] = useState<Production | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(
    requestedTab === "requisicao" || requestedTab === "balanco"
      ? requestedTab === "requisicao"
        ? "shopping"
        : "waste"
      : "details"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({});

  // Balanço pós-evento
  const [balanceForm, setBalanceForm] = useState({
    item: "",
    quantidade_produzida: "",
    quantidade_consumida: "",
    quantidade_descartada: "",
    quantidade_devolvida: "",
    unidade: "g",
    custo_desperdicio: "",
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<Production>(`/productions/${id}`, token)
      .then(async (prod) => {
        setProduction(prod);
        // requisição pedida pela URL: gera a lista automaticamente
        if (requestedTab === "requisicao" && prod.shopping_list.length === 0) {
          try {
            const items = await apiGet<Production["shopping_list"]>(
              `/productions/${id}/shopping-list`,
              token
            );
            setProduction({ ...prod, shopping_list: items });
          } catch {
            /* a aba mostra o estado vazio e permite gerar */
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // nomes das receitas para exibir nas linhas da produção
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<{ id: string; nome: string }[]>("/recipes", token)
      .then((recipes) => {
        const map: Record<string, string> = {};
        for (const r of recipes) map[r.id] = r.nome;
        setRecipeNames(map);
      })
      .catch(() => {});
  }, [id]);

  const handleTabChange = (key: Tab) => {
    setActiveTab(key);
    if (key === "shopping" && production && production.shopping_list.length === 0) {
      const token = getAccessToken();
      if (!token) return;
      apiGet<Production["shopping_list"]>(`/productions/${id}/shopping-list`, token)
        .then((items) =>
          setProduction((prev) => (prev ? { ...prev, shopping_list: items } : prev))
        )
        .catch(() => {});
    }
  };

  const handleSaveRequisicao = async (itemId: string) => {
    const token = getAccessToken();
    if (!token) return;
    const qtd = parseFloat(editQty);
    if (Number.isNaN(qtd) || qtd < 0) return;
    try {
      const updated = await apiPut<Production["shopping_list"][number]>(
        `/productions/${id}/shopping-list/${itemId}`,
        { quantidade_a_comprar: qtd },
        token
      );
      setProduction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          shopping_list: prev.shopping_list.map((i) => (i.id === itemId ? updated : i)),
        };
      });
      setEditingItemId(null);
      setEditQty("");
    } catch {
      alert("Erro ao atualizar requisição");
    }
  };

  const handleRegenerate = async () => {
    const token = getAccessToken();
    if (!token || !production) return;
    try {
      const items = await apiGet<Production["shopping_list"]>(
        `/productions/${id}/shopping-list?regenerate=true`,
        token
      );
      setProduction({ ...production, shopping_list: items });
    } catch {
      alert("Erro ao recalcular a lista");
    }
  };

  const handleAddBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !production) return;

    if (!balanceForm.item.trim()) {
      alert("Informe o item");
      return;
    }

    try {
      const newBalance = await apiPost<Production["waste_records"][number]>(
        `/productions/${id}/waste`,
        {
          item: balanceForm.item.trim(),
          quantidade_produzida: parseFloat(balanceForm.quantidade_produzida) || 0,
          quantidade_consumida: parseFloat(balanceForm.quantidade_consumida) || 0,
          quantidade_descartada: parseFloat(balanceForm.quantidade_descartada) || 0,
          quantidade_devolvida: parseFloat(balanceForm.quantidade_devolvida) || 0,
          unidade: balanceForm.unidade,
          custo_desperdicio: parseFloat(balanceForm.custo_desperdicio) || 0,
        },
        token
      );

      setProduction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          waste_records: [...prev.waste_records, newBalance],
          status: "finalizado",
        };
      });

      setBalanceForm({
        item: "",
        quantidade_produzida: "",
        quantidade_consumida: "",
        quantidade_descartada: "",
        quantidade_devolvida: "",
        unidade: balanceForm.unidade,
        custo_desperdicio: "",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao registrar balanço");
    }
  };

  const handleDeleteBalance = async (recordId: string) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const { apiDelete } = await import("@/lib/api");
      await apiDelete(`/productions/${id}/waste/${recordId}`, token);
      setProduction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          waste_records: prev.waste_records.filter((r) => r.id !== recordId),
        };
      });
    } catch (err) {
      alert("Erro ao excluir registro");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!production) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">{error || "Produção não encontrada"}</p>
        <Link href="/productions" className="text-primary-600 hover:underline mt-2 inline-block">
          ← Voltar para produções
        </Link>
      </div>
    );
  }

  const totalRequisicao = production.shopping_list.reduce(
    (sum, i) => sum + i.preco_estimado,
    0
  );
  const totalDesperdicio = production.waste_records.reduce(
    (sum, r) => sum + r.custo_desperdicio,
    0
  );
  const totalConsumido = production.waste_records.reduce(
    (sum, r) => sum + r.quantidade_consumida,
    0
  );
  const totalDevolvido = production.waste_records.reduce(
    (sum, r) => sum + r.quantidade_devolvida,
    0
  );

  const fmtBase = (qtd: number, unit: string) => {
    const [v, u] = getDisplayUnit(qtd, unit);
    return `${v.toLocaleString("pt-BR")} ${u}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/productions" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{production.nome}</h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                production.status === "finalizado"
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  : production.status === "em_andamento"
                  ? "bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300"
                  : "bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300"
              }`}
            >
              {production.status.replace("_", " ").charAt(0).toUpperCase() +
                production.status.replace("_", " ").slice(1)}
            </span>
          </div>
          <p className="text-text-secondary mt-1">
            {new Date(production.data).toLocaleDateString("pt-BR")}
            {production.convidados && ` · ${production.convidados} convidados`}
            {production.tipo && ` · ${production.tipo.replace("_", " ")}`}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Requisição</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {formatCurrency(totalRequisicao)}
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Descartado (R$)</p>
          <p className="text-xl font-bold text-danger-600 dark:text-danger-400 mt-1">
            {formatCurrency(totalDesperdicio)}
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Consumido / devolvido</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {totalConsumido.toLocaleString("pt-BR")}
            <span className="text-text-muted text-sm"> / {totalDevolvido.toLocaleString("pt-BR")}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface-alt rounded-lg p-1">
        {[
          { key: "details" as Tab, label: "Detalhes", icon: CheckCircle },
          { key: "shopping" as Tab, label: "Requisição", icon: ShoppingCart },
          { key: "waste" as Tab, label: "Balanço do evento", icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "details" && (
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Receitas / Itens</h2>
          {production.recipes.length === 0 ? (
            <p className="text-text-muted text-sm">Nenhuma receita ou item adicionado</p>
          ) : (
            <div className="space-y-2">
              {production.recipes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 border-b border-border-default last:border-0"
                >
                  <span className="text-text-primary">
                    {r.item_nome ||
                      (r.recipe_id && recipeNames[r.recipe_id]) ||
                      "Receita"}
                  </span>
                  <span className="text-sm text-text-muted">
                    {r.item_nome
                      ? "quantidade total do evento"
                      : `${r.escala_fator.toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })} receita${r.escala_fator === 1 ? "" : "s"}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "shopping" && (
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Requisição de ingredientes</h2>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700"
              title="Recalcula quantidades com o estoque atual"
            >
              <RotateCcw className="w-4 h-4" />
              Recalcular com estoque atual
            </button>
          </div>
          {production.shopping_list.length === 0 ? (
            <p className="text-text-muted text-sm">
              Nenhuma lista gerada. Adicione receitas ou itens à produção.
            </p>
          ) : (
            <div className="space-y-2">
              {production.shopping_list.map((item) => {
                const [displayQtd, displayUnit] = getDisplayUnit(
                  item.quantidade_total,
                  item.unidade_base
                );
                const [estoqueQtd, estoqueUnit] = getDisplayUnit(
                  item.quantidade_estoque,
                  item.unidade_base
                );
                const [comprarQtd, comprarUnit] = getDisplayUnit(
                  item.quantidade_a_comprar,
                  item.unidade_base
                );
                const unitSuffix = (u: string) =>
                  u === "g" ? "kg" : u === "ml" ? "L" : u;
                const editUnit = unitSuffix(item.unidade_base);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg border border-border-default"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{item.ingrediente}</p>
                      <p className="text-xs text-text-muted">
                        Necessário: {displayQtd.toLocaleString("pt-BR")} {displayUnit}
                        {" · "}Em estoque: {estoqueQtd.toLocaleString("pt-BR")} {estoqueUnit}
                      </p>
                    </div>
                    <div className="text-right">
                      {editingItemId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            autoFocus
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            placeholder={`Qtd (${editUnit})`}
                            className="w-28 px-2 py-1 border border-border-default rounded bg-bg-surface text-text-primary text-sm"
                          />
                          <button
                            onClick={() => handleSaveRequisicao(item.id)}
                            className="text-sm px-3 py-1 bg-primary-600 text-text-inverse rounded"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => { setEditingItemId(null); setEditQty(""); }}
                            className="text-sm px-2 py-1 text-text-muted"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingItemId(item.id);
                              // converte base para unidade de edição (kg/L)
                              const qtd =
                                item.unidade_base === "g" || item.unidade_base === "ml"
                                  ? item.quantidade_a_comprar / 1000
                                  : item.quantidade_a_comprar;
                              setEditQty(String(qtd));
                            }}
                            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            title="Clique para ajustar manualmente"
                          >
                            Pedir: {comprarQtd.toLocaleString("pt-BR")} {comprarUnit}
                          </button>
                          <p className="text-xs text-text-muted">
                            {formatCurrency(item.preco_estimado)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "waste" && (
        <div className="space-y-6">
          {/* Balanço form */}
          <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Balanço do evento</h2>
              <p className="text-sm text-text-muted mt-1">
                Para cada item: quanto foi consumido, quanto foi descartado (estava exposto) e
                quanto voltou (não estava exposto). O que volta é creditado no estoque.
              </p>
            </div>
            <form onSubmit={handleAddBalance} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Item *
                  </label>
                  <input
                    type="text"
                    value={balanceForm.item}
                    onChange={(e) =>
                      setBalanceForm((prev) => ({ ...prev, item: e.target.value }))
                    }
                    placeholder="Ex: brigadeiro, panacota..."
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Unidade
                  </label>
                  <select
                    value={balanceForm.unidade}
                    onChange={(e) =>
                      setBalanceForm((prev) => ({ ...prev, unidade: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Produzido
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={balanceForm.quantidade_produzida}
                    onChange={(e) =>
                      setBalanceForm((prev) => ({ ...prev, quantidade_produzida: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Consumido
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={balanceForm.quantidade_consumida}
                    onChange={(e) =>
                      setBalanceForm((prev) => ({ ...prev, quantidade_consumida: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Descartado (exposto)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={balanceForm.quantidade_descartada}
                    onChange={(e) =>
                      setBalanceForm((prev) => ({ ...prev, quantidade_descartada: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-danger-500 focus:border-danger-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Voltou (não exposto)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={balanceForm.quantidade_devolvida}
                    onChange={(e) =>
                      setBalanceForm((prev) => ({ ...prev, quantidade_devolvida: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="max-w-xs">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Custo do descartado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={balanceForm.custo_desperdicio}
                  onChange={(e) =>
                    setBalanceForm((prev) => ({ ...prev, custo_desperdicio: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Registrar balanço
              </button>
            </form>
          </div>

          {/* Balanço records */}
          {production.waste_records.length > 0 && (
            <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">Registros</h2>
              {production.waste_records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-3 px-4 bg-bg-surface-alt rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{record.item}</p>
                    <p className="text-xs text-text-muted">
                      Produzido: {record.quantidade_produzida.toLocaleString("pt-BR")} {record.unidade}
                      {" · "}Consumido: {record.quantidade_consumida.toLocaleString("pt-BR")}
                      {" · "}Descartado:{" "}
                      <span className="text-danger-600 dark:text-danger-400">
                        {record.quantidade_descartada.toLocaleString("pt-BR")}
                      </span>
                      {" · "}Voltou: {record.quantidade_devolvida.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-danger-600 dark:text-danger-400">
                      {formatCurrency(record.custo_desperdicio)}
                    </span>
                    <button
                      onClick={() => handleDeleteBalance(record.id)}
                      className="p-1 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
