"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { toBaseUnit } from "@/lib/units";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

const UNIDADES = ["kg", "g", "L", "ml", "unidade"];
const TIPOS = ["entrada", "principal", "sobremesa", "bebida", "acompanhamento"];

interface IngredientForm {
  ingrediente: string;
  quantidade: string;
  unidade: string;
  preco_unitario: string;
}

export default function NewRecipePage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [rendimentoBase, setRendimentoBase] = useState("");
  const [tipo, setTipo] = useState("");
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    { ingrediente: "", quantidade: "", unidade: "g", preco_unitario: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      { ingrediente: "", quantidade: "", unidade: "g", preco_unitario: "" },
    ]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length === 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientForm, value: string) => {
    setIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError("Não autenticado");
      setSaving(false);
      return;
    }

    // Validate
    if (!nome.trim()) {
      setError("Nome da receita é obrigatório");
      setSaving(false);
      return;
    }

    const validIngredients = ingredients.filter((ing) => ing.ingrediente.trim() && ing.quantidade);
    if (validIngredients.length === 0) {
      setError("Adicione pelo menos um ingrediente");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        nome: nome.trim(),
        rendimento_base: parseInt(rendimentoBase) || 1,
        tipo: tipo || null,
        ingredients: validIngredients.map((ing) => {
          const qtd = parseFloat(ing.quantidade);
          const [baseQtd, baseUnit] = toBaseUnit(qtd, ing.unidade);
          return {
            ingrediente: ing.ingrediente.trim(),
            quantidade: qtd,
            unidade: ing.unidade,
            preco_unitario: parseFloat(ing.preco_unitario) || 0,
            unidade_base: baseUnit,
            unidade_base_qtd: baseQtd,
          };
        }),
      };

      await apiPost("/recipes", payload, token);
      router.push("/recipes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar receita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/recipes" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nova Receita</h1>
          <p className="text-text-secondary mt-1">Cadastre uma receita com ingredientes e custos.</p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Informações básicas</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nome da receita *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Panacota, Feijoada, Macarrão..."
              className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Rendimento (porções) *
              </label>
              <input
                type="number"
                value={rendimentoBase}
                onChange={(e) => setRendimentoBase(e.target.value)}
                placeholder="Ex: 10"
                min="1"
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Selecione...</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Ingredientes</h2>
            <button
              type="button"
              onClick={addIngredient}
              className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {ingredients.map((ing, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-3 items-end p-3 bg-bg-surface-alt rounded-lg"
            >
              <div className="col-span-4">
                <label className="block text-xs text-text-muted mb-1">Ingrediente</label>
                <input
                  type="text"
                  value={ing.ingrediente}
                  onChange={(e) => updateIngredient(index, "ingrediente", e.target.value)}
                  placeholder="Ex: farinha de trigo"
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Quantidade</label>
                <input
                  type="number"
                  value={ing.quantidade}
                  onChange={(e) => updateIngredient(index, "quantidade", e.target.value)}
                  placeholder="Ex: 500"
                  step="0.001"
                  min="0"
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Unidade</label>
                <select
                  value={ing.unidade}
                  onChange={(e) => updateIngredient(index, "unidade", e.target.value)}
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="block text-xs text-text-muted mb-1">Preço unitário (R$)</label>
                <input
                  type="number"
                  value={ing.preco_unitario}
                  onChange={(e) => updateIngredient(index, "preco_unitario", e.target.value)}
                  placeholder="Ex: 5.99"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="col-span-1">
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  disabled={ingredients.length === 1}
                  className="p-2 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600 dark:hover:text-danger-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remover ingrediente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/recipes"
            className="px-6 py-2 border border-border-default rounded-lg text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-text-inverse rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Salvando..." : "Salvar receita"}
          </button>
        </div>
      </form>
    </div>
  );
}
