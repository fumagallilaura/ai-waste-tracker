"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPut } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

const UNIDADES = ["kg", "g", "L", "ml", "unidade"];
const TIPOS = ["entrada", "principal", "sobremesa", "bebida", "acompanhamento"];

interface IngredientForm {
  ingrediente: string;
  quantidade: string;
  unidade: string;
  preco_unitario: string;
}

interface RecipeResponse {
  id: string;
  nome: string;
  rendimento_base: number;
  tipo: string | null;
  ingredients: Array<{
    ingrediente: string;
    quantidade: number;
    unidade: string;
    preco_unitario: number;
  }>;
}

function emptyIngredient(): IngredientForm {
  return { ingrediente: "", quantidade: "", unidade: "g", preco_unitario: "" };
}

export default function EditRecipePage() {
  const router = useRouter();
  const params = useParams();
  const recipeId = typeof params.id === "string" ? params.id : "";

  const [nome, setNome] = useState("");
  const [rendimentoBase, setRendimentoBase] = useState("");
  const [tipo, setTipo] = useState("");
  const [ingredients, setIngredients] = useState<IngredientForm[]>([emptyIngredient()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) return;
    const token = getAccessToken();
    if (!token) {
      setError("Não autenticado");
      setLoading(false);
      return;
    }

    apiGet<RecipeResponse>(`/recipes/${recipeId}`, token)
      .then((recipe) => {
        setNome(recipe.nome);
        setRendimentoBase(String(recipe.rendimento_base));
        setTipo(recipe.tipo || "");
        setIngredients(
          recipe.ingredients.length > 0
            ? recipe.ingredients.map((ing) => ({
                ingrediente: ing.ingrediente,
                quantidade: String(ing.quantidade),
                unidade: UNIDADES.includes(ing.unidade) ? ing.unidade : "g",
                preco_unitario: String(ing.preco_unitario ?? ""),
              }))
            : [emptyIngredient()]
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar receita"))
      .finally(() => setLoading(false));
  }, [recipeId]);

  const updateIngredient = (index: number, field: keyof IngredientForm, value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
  };

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()]);

  const removeIngredient = (index: number) => {
    setIngredients((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
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
      await apiPut(
        `/recipes/${recipeId}`,
        {
          nome: nome.trim(),
          rendimento_base: parseInt(rendimentoBase, 10) || 1,
          tipo: tipo || null,
          ingredients: validIngredients.map((ing) => ({
            ingrediente: ing.ingrediente.trim(),
            quantidade: parseFloat(ing.quantidade),
            unidade: ing.unidade,
            preco_unitario: parseFloat(ing.preco_unitario) || 0,
          })),
        },
        token
      );
      router.push("/recipes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar receita");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/recipes" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Editar receita</h1>
          <p className="text-text-secondary mt-1">Ajuste ingredientes, quantidades e preços.</p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
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
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Quantidade</label>
                <input
                  type="number"
                  value={ing.quantidade}
                  onChange={(e) => updateIngredient(index, "quantidade", e.target.value)}
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
                <label className="block text-xs text-text-muted mb-1">Preço por kg/L/un (R$)</label>
                <input
                  type="number"
                  value={ing.preco_unitario}
                  onChange={(e) => updateIngredient(index, "preco_unitario", e.target.value)}
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
