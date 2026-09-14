"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/units";
import { toastError, toastSuccess } from "@/lib/toast";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";

interface CatalogIngredient {
  ingrediente: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
}

interface CatalogRecipe {
  slug: string;
  nome: string;
  rendimento_base: number;
  tipo: string | null;
  ingredients: CatalogIngredient[];
}

function estimateCost(ingredients: CatalogIngredient[]): number {
  return ingredients.reduce(
    (sum, ing) =>
      sum +
      ing.preco_unitario *
        (ing.unidade === "g" || ing.unidade === "ml"
          ? ing.quantidade / 1000
          : ing.quantidade),
    0
  );
}

export default function RecipesCatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<CatalogRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adopting, setAdopting] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<CatalogRecipe[]>("/recipes/catalog", token)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdopt = async (slug: string) => {
    const token = getAccessToken();
    if (!token) return;
    setAdopting(slug);
    try {
      const recipe = await apiPost<{ nome: string }>(
        `/recipes/catalog/${slug}/adopt`,
        {},
        token
      );
      toastSuccess(`${recipe.nome} adicionada às suas receitas`);
      router.push("/recipes");
    } catch {
      toastError("Erro ao adicionar receita");
      setAdopting(null);
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
      <div className="flex items-start gap-4">
        <Link
          href="/recipes"
          className="mt-1 p-2 rounded-lg hover:bg-bg-surface-alt text-text-muted hover:text-text-primary transition-colors"
          aria-label="Voltar para receitas"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Receitas prontas</h1>
          <p className="text-text-secondary mt-1">
            Clássicos de evento — adicione e ajuste preços se precisar
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {items.map((recipe) => {
          const custo = estimateCost(recipe.ingredients);
          const busy = adopting === recipe.slug;
          return (
            <div
              key={recipe.slug}
              className="bg-bg-surface rounded-xl border border-border-default p-6 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-text-primary">{recipe.nome}</h3>
                    {recipe.tipo && (
                      <span className="text-xs bg-bg-surface-alt text-text-muted px-2 py-1 rounded-full">
                        {recipe.tipo}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    Rende {recipe.rendimento_base} porções · {recipe.ingredients.length}{" "}
                    ingredientes
                  </p>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                    Custo ref.: {formatCurrency(custo)}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {recipe.ingredients.slice(0, 5).map((ing) => (
                      <span
                        key={ing.ingrediente}
                        className="text-xs bg-bg-surface-alt text-text-secondary px-2 py-1 rounded"
                      >
                        {ing.quantidade} {ing.unidade} {ing.ingrediente}
                      </span>
                    ))}
                    {recipe.ingredients.length > 5 && (
                      <span className="text-xs text-text-muted">
                        +{recipe.ingredients.length - 5} ingredientes
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdopt(recipe.slug)}
                  disabled={adopting !== null}
                  className="shrink-0 flex items-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60 text-sm"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookOpen className="w-4 h-4" />
                  )}
                  Usar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
