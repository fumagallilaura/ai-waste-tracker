"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency, getDisplayUnit } from "@/lib/units";
import { Plus, Edit2, Trash2, Copy, Globe } from "lucide-react";

interface Ingredient {
  id: string;
  ingrediente: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  unidade_base: string;
  unidade_base_qtd: number;
}

interface Recipe {
  id: string;
  nome: string;
  rendimento_base: number;
  tipo: string | null;
  ingredients: Ingredient[];
  created_at: string;
  updated_at: string;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<Recipe[]>("/recipes", token)
      .then(setRecipes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      const { apiDelete } = await import("@/lib/api");
      await apiDelete(`/recipes/${id}`, token);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert("Erro ao excluir receita");
    }
  };

  const handleDuplicate = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const { apiPost } = await import("@/lib/api");
      const newRecipe = await apiPost<Recipe>(`/recipes/${id}/duplicate`, {}, token);
      setRecipes((prev) => [newRecipe, ...prev]);
    } catch (err) {
      alert("Erro ao duplicar receita");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Receitas</h1>
          <p className="text-text-secondary mt-1">
            {recipes.length} {recipes.length === 1 ? "receita cadastrada" : "receitas cadastradas"}
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="flex items-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova receita
        </Link>
        <Link
          href="/recipes/import"
          data-testid="import-recipe-button"
          className="flex items-center gap-2 bg-bg-surface text-primary-700 dark:text-primary-300 px-4 py-2 rounded-lg border border-primary-300 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm"
        >
          <Globe className="w-4 h-4" />
          Importar da internet
        </Link>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="bg-bg-surface rounded-xl border border-border-default p-12 text-center">
          <p className="text-text-muted text-lg mb-4">Nenhuma receita cadastrada</p>
          <Link
            href="/recipes/new"
            className="inline-flex items-center gap-2 bg-primary-600 text-text-inverse px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar primeira receita
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {recipes.map((recipe) => {
            // preco_unitario é preço por kg/L/unidade da unidade original do ingrediente
            const custoTotal = recipe.ingredients.reduce(
              (sum, ing) =>
                sum +
                ing.preco_unitario *
                  (ing.unidade === "g" || ing.unidade === "ml"
                    ? ing.quantidade / 1000
                    : ing.quantidade),
              0
            );

            return (
              <div
                key={recipe.id}
                className="bg-bg-surface rounded-xl border border-border-default p-6 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-text-primary">{recipe.nome}</h3>
                      {recipe.tipo && (
                        <span className="text-xs bg-bg-surface-alt text-text-muted px-2 py-1 rounded-full">
                          {recipe.tipo}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                      Rende {recipe.rendimento_base} porções · {recipe.ingredients.length} ingredientes
                    </p>
                    <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                      Custo estimado: {formatCurrency(custoTotal)}
                    </p>

                    {/* Ingredients preview */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {recipe.ingredients.slice(0, 5).map((ing) => {
                        const [displayQtd, displayUnit] = getDisplayUnit(
                          ing.unidade_base_qtd,
                          ing.unidade_base
                        );
                        return (
                          <span
                            key={ing.id}
                            className="text-xs bg-bg-surface-alt text-text-secondary px-2 py-1 rounded"
                          >
                            {displayQtd} {displayUnit} {ing.ingrediente}
                          </span>
                        );
                      })}
                      {recipe.ingredients.length > 5 && (
                        <span className="text-xs text-text-muted">
                          +{recipe.ingredients.length - 5} ingredientes
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/recipes/${recipe.id}/edit`}
                      className="p-2 rounded-lg hover:bg-bg-surface-alt text-text-muted hover:text-text-primary transition-colors"
                      aria-label="Editar receita"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(recipe.id)}
                      className="p-2 rounded-lg hover:bg-bg-surface-alt text-text-muted hover:text-text-primary transition-colors"
                      aria-label="Duplicar receita"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(recipe.id)}
                      className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                      aria-label="Excluir receita"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
