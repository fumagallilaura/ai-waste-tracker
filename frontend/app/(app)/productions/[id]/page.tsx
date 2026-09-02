"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency, getDisplayUnit } from "@/lib/units";
import { ArrowLeft, ShoppingCart, AlertTriangle, CheckCircle, Plus, Trash2 } from "lucide-react";

interface Production {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  convidados: number | null;
  status: string;
  recipes: { id: string; recipe_id: string | null; escala_fator: number; item_nome: string | null }[];
  shopping_list: {
    id: string;
    ingrediente: string;
    quantidade_total: number;
    unidade_base: string;
    preco_estimado: number;
    ja_tem_estoque: boolean;
  }[];
  waste_records: {
    id: string;
    ingrediente_ou_prato: string;
    quantidade_sobrou: number;
    unidade: string;
    motivo: string;
    custo_desperdicio: number;
    created_at: string;
  }[];
}

const WASTE_MOTIVOS = [
  { value: "produzi_demais", label: "Produzi demais" },
  { value: "venceu", label: "Venceu" },
  { value: "errei_receita", label: "Errei receita" },
  { value: "cliente_nao_comeu", label: "Cliente não comeu" },
  { value: "outro", label: "Outro" },
];

type Tab = "shopping" | "waste" | "details";

export default function ProductionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [production, setProduction] = useState<Production | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Waste form
  const [wasteForm, setWasteForm] = useState({
    ingrediente_ou_prato: "",
    quantidade_sobrou: "",
    unidade: "g",
    motivo: "",
    custo_desperdicio: "",
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<Production>(`/productions/${id}`, token)
      .then(setProduction)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleEstoque = async (itemId: string) => {
    const token = getAccessToken();
    if (!token || !production) return;

    const item = production.shopping_list.find((i) => i.id === itemId);
    if (!item) return;

    try {
      const updated = await apiPut(
        `/productions/${id}/shopping-list/${itemId}`,
        { ja_tem_estoque: !item.ja_tem_estoque },
        token
      );
      setProduction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          shopping_list: prev.shopping_list.map((i) => (i.id === itemId ? updated : i)),
        };
      });
    } catch (err) {
      alert("Erro ao atualizar item");
    }
  };

  const handleAddWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !production) return;

    if (!wasteForm.ingrediente_ou_prato || !wasteForm.quantidade_sobrou || !wasteForm.motivo) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const newWaste = await apiPost(
        `/productions/${id}/waste`,
        {
          ingrediente_ou_prato: wasteForm.ingrediente_ou_prato,
          quantidade_sobrou: parseFloat(wasteForm.quantidade_sobrou),
          unidade: wasteForm.unidade,
          motivo: wasteForm.motivo,
          custo_desperdicio: parseFloat(wasteForm.custo_desperdicio) || 0,
        },
        token
      );

      setProduction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          waste_records: [...prev.waste_records, newWaste],
          status: "finalizado",
        };
      });

      setWasteForm({
        ingrediente_ou_prato: "",
        quantidade_sobrou: "",
        unidade: "g",
        motivo: "",
        custo_desperdicio: "",
      });
    } catch (err) {
      alert("Erro ao registrar desperdício");
    }
  };

  const handleDeleteWaste = async (recordId: string) => {
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
        <p className="text-text-muted">Produção não encontrada</p>
        <Link href="/productions" className="text-primary-600 hover:underline mt-2 inline-block">
          ← Voltar para produções
        </Link>
      </div>
    );
  }

  const totalDesperdicio = production.waste_records.reduce(
    (sum, r) => sum + r.custo_desperdicio,
    0
  );
  const totalCompras = production.shopping_list.reduce(
    (sum, i) => sum + (i.ja_tem_estoque ? 0 : i.preco_estimado),
    0
  );

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
          <p className="text-sm text-text-muted">Total compras</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {formatCurrency(totalCompras)}
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Desperdício</p>
          <p className="text-xl font-bold text-danger-600 dark:text-danger-400 mt-1">
            {formatCurrency(totalDesperdicio)}
          </p>
        </div>
        <div className="bg-bg-surface rounded-xl border border-border-default p-4">
          <p className="text-sm text-text-muted">Registros</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {production.waste_records.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface-alt rounded-lg p-1">
        {[
          { key: "details" as Tab, label: "Detalhes", icon: CheckCircle },
          { key: "shopping" as Tab, label: "Lista de Compras", icon: ShoppingCart },
          { key: "waste" as Tab, label: "Desperdício", icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
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
                    {r.item_nome || `Receita ${r.recipe_id?.slice(0, 8)}...`}
                  </span>
                  <span className="text-sm text-text-muted">
                    Escala: {r.escala_fator.toFixed(1)}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "shopping" && (
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Lista de Compras</h2>
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
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-colors ${
                      item.ja_tem_estoque
                        ? "bg-bg-surface-alt border-border-default opacity-60"
                        : "border-border-default"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.ja_tem_estoque}
                        onChange={() => handleToggleEstoque(item.id)}
                        className="w-4 h-4 text-primary-600 rounded border-border-default focus:ring-primary-500"
                      />
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            item.ja_tem_estoque
                              ? "text-text-muted line-through"
                              : "text-text-primary"
                          }`}
                        >
                          {item.ingrediente}
                        </p>
                        <p className="text-xs text-text-muted">
                          {displayQtd} {displayUnit} · {formatCurrency(item.preco_estimado)}
                        </p>
                      </div>
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
          {/* Waste form */}
          <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Registrar Desperdício</h2>
            <form onSubmit={handleAddWaste} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Ingrediente ou prato *
                  </label>
                  <input
                    type="text"
                    value={wasteForm.ingrediente_ou_prato}
                    onChange={(e) =>
                      setWasteForm((prev) => ({
                        ...prev,
                        ingrediente_ou_prato: e.target.value,
                      }))
                    }
                    placeholder="Ex: tomate, panacota..."
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      value={wasteForm.quantidade_sobrou}
                      onChange={(e) =>
                        setWasteForm((prev) => ({
                          ...prev,
                          quantidade_sobrou: e.target.value,
                        }))
                      }
                      placeholder="Ex: 500"
                      step="0.1"
                      min="0"
                      className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Unidade
                    </label>
                    <select
                      value={wasteForm.unidade}
                      onChange={(e) =>
                        setWasteForm((prev) => ({ ...prev, unidade: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="unidade">unidade</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Custo (R$)
                    </label>
                    <input
                      type="number"
                      value={wasteForm.custo_desperdicio}
                      onChange={(e) =>
                        setWasteForm((prev) => ({
                          ...prev,
                          custo_desperdicio: e.target.value,
                        }))
                      }
                      placeholder="0"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Motivo *
                </label>
                <select
                  value={wasteForm.motivo}
                  onChange={(e) =>
                    setWasteForm((prev) => ({ ...prev, motivo: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Selecione...</option>
                  {WASTE_MOTIVOS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 bg-danger-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-danger-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Registrar desperdício
              </button>
            </form>
          </div>

          {/* Waste records */}
          {production.waste_records.length > 0 && (
            <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">Registros</h2>
              {production.waste_records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-3 px-4 bg-bg-surface-alt rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {record.ingrediente_ou_prato}
                    </p>
                    <p className="text-xs text-text-muted">
                      {record.quantidade_sobrou} {record.unidade} ·{" "}
                      {WASTE_MOTIVOS.find((m) => m.value === record.motivo)?.label || record.motivo}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-danger-600 dark:text-danger-400">
                      {formatCurrency(record.custo_desperdicio)}
                    </span>
                    <button
                      onClick={() => handleDeleteWaste(record.id)}
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
