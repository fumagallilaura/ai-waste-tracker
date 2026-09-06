"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getDisplayUnit, formatCurrency } from "@/lib/units";
import { Plus, Package, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface StockItem {
  id: string;
  ingrediente: string;
  unidade_base: string;
  quantidade: number;
  preco_unitario: number;
}

const UNIDADES = [
  { value: "g", label: "g (gramas)" },
  { value: "kg", label: "kg (quilos)" },
  { value: "ml", label: "ml (mililitros)" },
  { value: "L", label: "L (litros)" },
  { value: "unidade", label: "unidade" },
];

export default function EstoquePage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nova entrada
  const [entrada, setEntrada] = useState({ ingrediente: "", quantidade: "", unidade: "kg", preco_unitario: "" });
  const [saving, setSaving] = useState(false);

  // Ajuste rápido por item
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");

  const load = () => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<StockItem[]>("/stock", token)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !entrada.ingrediente.trim() || !entrada.quantidade) return;
    setSaving(true);
    setError(null);
    try {
      const item = await apiPost<StockItem>("/stock", {
        ingrediente: entrada.ingrediente.trim(),
        unidade: entrada.unidade,
        quantidade_delta: parseFloat(entrada.quantidade),
        preco_unitario: parseFloat(entrada.preco_unitario) || 0,
      }, token);
      setItems((prev) => {
        const existing = prev.findIndex((i) => i.id === item.id);
        if (existing >= 0) {
          const copy = [...prev];
          copy[existing] = item;
          return copy;
        }
        return [...prev, item].sort((a, b) => a.ingrediente.localeCompare(b.ingrediente));
      });
      setEntrada({ ingrediente: "", quantidade: "", unidade: "kg", preco_unitario: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar entrada");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (item: StockItem, direcao: "entrada" | "saida") => {
    const token = getAccessToken();
    if (!token || !adjustQty) return;
    const qtd = parseFloat(adjustQty);
    if (Number.isNaN(qtd) || qtd <= 0) return;

    const unit = item.unidade_base === "g" ? "kg" : item.unidade_base === "ml" ? "L" : "unidade";
    const delta = direcao === "entrada" ? qtd : -qtd;
    try {
      const updated = await apiPost<StockItem>("/stock", {
        ingrediente: item.ingrediente,
        unidade: unit,
        quantidade_delta: delta,
      }, token);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setAdjustingId(null);
      setAdjustQty("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ajustar estoque");
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiDelete(`/stock/${id}`, token);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert("Erro ao remover item");
    }
  };

  const fmtQty = (qtd: number, unit: string) => {
    const [v, u] = getDisplayUnit(qtd, unit);
    return `${v.toLocaleString("pt-BR")} ${u}`;
  };

  const unitForAdjust = (base: string) =>
    base === "g" ? "kg" : base === "ml" ? "L" : "unidade";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Estoque</h1>
        <p className="text-text-secondary mt-1">
          Controle o que você já tem. A lista de requisição das produções desconta o estoque automaticamente.
        </p>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {/* Entrada */}
      <form
        onSubmit={handleEntrada}
        className="bg-bg-surface rounded-xl border border-border-default p-6"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-4">Registrar entrada / saída</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1">Ingrediente *</label>
            <input
              type="text"
              value={entrada.ingrediente}
              onChange={(e) => setEntrada((p) => ({ ...p, ingrediente: e.target.value }))}
              placeholder="Ex: farinha de trigo"
              required
              className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Quantidade *</label>
            <input
              type="number"
              step="0.001"
              value={entrada.quantidade}
              onChange={(e) => setEntrada((p) => ({ ...p, quantidade: e.target.value }))}
              placeholder="Ex: 5"
              required
              className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Unidade</label>
            <select
              value={entrada.unidade}
              onChange={(e) => setEntrada((p) => ({ ...p, unidade: e.target.value }))}
              className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {UNIDADES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-1">Preço/un.</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={entrada.preco_unitario}
                onChange={(e) => setEntrada((p) => ({ ...p, preco_unitario: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Positivo = entrada (comprou / voltou do evento). Negativo = saída (usou / perdeu).
          Preço por kg, L ou unidade.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 flex items-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
        >
          <Plus className="w-4 h-4" />
          {saving ? "Registrando..." : "Registrar movimentação"}
        </button>
      </form>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-bg-surface rounded-xl border border-border-default">
          <Package className="w-12 h-12 mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">Estoque vazio. Registre sua primeira entrada acima.</p>
        </div>
      ) : (
        <div className="bg-bg-surface rounded-xl border border-border-default divide-y divide-border-default">
          {items.map((item) => {
            const [priceQty, priceUnit] = item.unidade_base === "g"
              ? [item.preco_unitario, "kg"]
              : item.unidade_base === "ml"
              ? [item.preco_unitario, "L"]
              : [item.preco_unitario, "unidade"];
            return (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-text-primary">{item.ingrediente}</p>
                  <p className="text-sm text-text-muted">
                    {fmtQty(item.quantidade, item.unidade_base)}
                    {item.preco_unitario > 0 &&
                      ` · ${formatCurrency(item.preco_unitario)}/${priceUnit}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {adjustingId === item.id ? (
                    <>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        autoFocus
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(e.target.value)}
                        placeholder={`Qtd (${unitForAdjust(item.unidade_base)})`}
                        className="w-32 px-2 py-1 border border-border-default rounded bg-bg-surface text-text-primary text-sm"
                      />
                      <button
                        onClick={() => handleAdjust(item, "entrada")}
                        className="p-1.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600"
                        title="Confirmar entrada"
                      >
                        <ArrowUpCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleAdjust(item, "saida")}
                        className="p-1.5 rounded hover:bg-warning-50 dark:hover:bg-warning-900/20 text-warning-600"
                        title="Confirmar saída"
                      >
                        <ArrowDownCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setAdjustingId(null); setAdjustQty(""); }}
                        className="p-1.5 rounded hover:bg-bg-surface-alt text-text-muted"
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setAdjustingId(item.id); setAdjustQty(""); }}
                        className="text-sm px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:text-text-primary"
                      >
                        Ajustar
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600"
                        aria-label={`Remover ${item.ingrediente}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
