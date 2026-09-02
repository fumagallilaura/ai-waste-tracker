"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { saveRecipePrefill } from "@/lib/prefill";
import { ArrowLeft, Globe, Loader2 } from "lucide-react";

interface ImportedIngredient {
  ingrediente: string;
  quantidade: number;
  unidade: string;
  original: string;
}

interface ImportResult {
  nome: string;
  rendimento_base: number;
  tipo: string | null;
  ingredients: ImportedIngredient[];
  source_url: string;
}

const UNIDADES = ["kg", "g", "L", "ml", "unidade"];

export default function ImportRecipePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const token = getAccessToken();
    if (!token) {
      setError("Não autenticado");
      setLoading(false);
      return;
    }

    try {
      const imported = await apiPost<ImportResult>("/recipes/import", { url }, token);
      setResult(imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao importar receita");
    } finally {
      setLoading(false);
    }
  };

  const updateIngredient = (index: number, field: keyof ImportedIngredient, value: string) => {
    setResult((prev) => {
      if (!prev) return prev;
      const ingredients = [...prev.ingredients];
      ingredients[index] = {
        ...ingredients[index],
        [field]: field === "quantidade" ? parseFloat(value) || 0 : value,
      };
      return { ...prev, ingredients };
    });
  };

  const removeIngredient = (index: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      return { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) };
    });
  };

  const useAsDraft = () => {
    if (!result) return;
    if (result.ingredients.length === 0) {
      setError("Adicione pelo menos um ingrediente.");
      return;
    }
    saveRecipePrefill({
      nome: result.nome,
      rendimento_base: String(result.rendimento_base),
      tipo: result.tipo ?? "",
      ingredients: result.ingredients.map((i) => ({
        ingrediente: i.ingrediente,
        quantidade: String(i.quantidade),
        unidade: UNIDADES.includes(i.unidade) ? i.unidade : "unidade",
        preco_unitario: "",
      })),
    });
    router.push("/recipes/new");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/recipes" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Importar receita</h1>
          <p className="text-text-secondary mt-1">
            Cole o link de uma receita da internet e importe os ingredientes.
          </p>
        </div>
      </div>

      {error && (
        <div
          data-testid="import-error"
          className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300 text-sm"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleImport}
        className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4"
      >
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-text-secondary mb-1">
            URL da receita
          </label>
          <div className="flex gap-3">
            <input
              id="url"
              data-testid="import-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com.br/receita-de-panacota"
              required
              className="flex-1 px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              data-testid="import-fetch-button"
              disabled={loading || !url}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-text-inverse rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              {loading ? "Buscando..." : "Buscar receita"}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Funciona com sites que publicam dados estruturados (maioria dos portais de receita).
          </p>
        </div>
      </form>

      {result && (
        <div data-testid="import-preview" className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Revisar antes de salvar</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nome</label>
              <input
                data-testid="import-nome"
                type="text"
                value={result.nome}
                onChange={(e) => setResult({ ...result, nome: e.target.value })}
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Rendimento (porções)
              </label>
              <input
                type="number"
                min="1"
                value={result.rendimento_base}
                onChange={(e) =>
                  setResult({ ...result, rendimento_base: parseInt(e.target.value) || 1 })
                }
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            {result.ingredients.map((ing, index) => (
              <div
                key={`${ing.ingrediente}-${index}`}
                data-testid="import-ingredient-row"
                className="grid grid-cols-12 gap-3 items-center p-3 bg-bg-surface-alt rounded-lg"
              >
                <div className="col-span-6">
                  <input
                    type="text"
                    value={ing.ingrediente}
                    onChange={(e) => updateIngredient(index, "ingrediente", e.target.value)}
                    className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-[11px] text-text-muted mt-1 truncate" title={ing.original}>
                    {ing.original}
                  </p>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={ing.quantidade}
                    onChange={(e) => updateIngredient(index, "quantidade", e.target.value)}
                    className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={UNIDADES.includes(ing.unidade) ? ing.unidade : "unidade"}
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
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                    aria-label="Remover ingrediente"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/recipes"
              className="px-6 py-2 border border-border-default rounded-lg text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="button"
              data-testid="import-use-button"
              onClick={useAsDraft}
              className="px-6 py-2 bg-primary-600 text-text-inverse rounded-lg hover:bg-primary-700 transition-colors"
            >
              Usar esta receita
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
