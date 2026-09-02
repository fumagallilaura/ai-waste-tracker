"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Plus, Trash2, ArrowLeft, BookOpen, UtensilsCrossed } from "lucide-react";

interface Recipe {
  id: string;
  nome: string;
  rendimento_base: number;
}

type FluxoMode = "recipe" | "manual";

interface ManualItem {
  nome: string;
  quantidadePorPessoa: string;
  unidade: string;
}

const UNIDADES = ["g", "ml", "unidade"];
const TIPOS_EVENTO = [
  "casamento",
  "corporativo",
  "aniversario",
  "formatura",
  "coffee_break",
  "turno_diario",
  "outro",
];

export default function NewProductionPage() {
  const router = useRouter();
  const [fluxoMode, setFluxoMode] = useState<FluxoMode>("recipe");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState("");
  const [convidados, setConvidados] = useState("");

  // Fluxo A: recipe-based
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<
    { recipeId: string; escalaFator: number }[]
  >([]);

  // Fluxo B: manual items
  const [manualItems, setManualItems] = useState<ManualItem[]>([
    { nome: "", quantidadePorPessoa: "", unidade: "g" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiGet<Recipe[]>("/recipes", token)
      .then(setRecipes)
      .catch(() => {});
  }, []);

  const addManualItem = () => {
    setManualItems((prev) => [
      ...prev,
      { nome: "", quantidadePorPessoa: "", unidade: "g" },
    ]);
  };

  const removeManualItem = (index: number) => {
    if (manualItems.length === 1) return;
    setManualItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateManualItem = (index: number, field: keyof ManualItem, value: string) => {
    setManualItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleRecipe = (recipeId: string) => {
    setSelectedRecipes((prev) => {
      const exists = prev.find((r) => r.recipeId === recipeId);
      if (exists) {
        return prev.filter((r) => r.recipeId !== recipeId);
      }
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return prev;
      return [...prev, { recipeId, escalaFator: 1 }];
    });
  };

  const updateEscalaFator = (recipeId: string, fator: number) => {
    setSelectedRecipes((prev) =>
      prev.map((r) => (r.recipeId === recipeId ? { ...r, escalaFator: fator } : r))
    );
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

    if (!nome.trim() || !data) {
      setError("Nome e data são obrigatórios");
      setSaving(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        nome: nome.trim(),
        tipo,
        data,
        convidados: convidados ? parseInt(convidados) : null,
        recipes: [],
      };

      if (fluxoMode === "recipe") {
        payload.recipes = selectedRecipes.map((sr) => {
          const recipe = recipes.find((r) => r.id === sr.recipeId);
          const numConvidados = convidados ? parseInt(convidados) : recipe?.rendimento_base || 1;
          return {
            recipe_id: sr.recipeId,
            escala_fator: numConvidados / (recipe?.rendimento_base || 1),
          };
        });
      } else {
        payload.recipes = manualItems
          .filter((item) => item.nome.trim() && item.quantidadePorPessoa)
          .map((item) => ({
            recipe_id: null,
            escala_fator: convidados ? parseInt(convidados) : 1,
            item_nome: item.nome.trim(),
            item_quantidade_base: parseFloat(item.quantidadePorPessoa),
            item_unidade: item.unidade,
          }));
      }

      await apiPost("/productions", payload, token);
      router.push("/productions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar produção");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/productions" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nova Produção</h1>
          <p className="text-text-secondary mt-1">
            Crie um evento ou turno de operação.
          </p>
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
          <h2 className="text-lg font-semibold text-text-primary">Informações</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nome *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Casamento Ana e Pedro, Almoço de terça..."
              className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Selecione...</option>
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ").charAt(0).toUpperCase() + t.replace("_", " ").slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Data *</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Convidados / Pessoas
              </label>
              <input
                type="number"
                value={convidados}
                onChange={(e) => setConvidados(e.target.value)}
                placeholder="Ex: 100"
                min="1"
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Fluxo mode selector */}
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Como vai servir?</h2>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFluxoMode("recipe")}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                fluxoMode === "recipe"
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                  : "border-border-default hover:border-border-strong"
              }`}
            >
              <BookOpen
                className={`w-5 h-5 ${
                  fluxoMode === "recipe"
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-text-muted"
                }`}
              />
              <div className="text-left">
                <p
                  className={`text-sm font-medium ${
                    fluxoMode === "recipe"
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-text-primary"
                  }`}
                >
                  Usar receitas cadastradas
                </p>
                <p className="text-xs text-text-muted">
                  Selecione receitas e escale automaticamente
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFluxoMode("manual")}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                fluxoMode === "manual"
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                  : "border-border-default hover:border-border-strong"
              }`}
            >
              <UtensilsCrossed
                className={`w-5 h-5 ${
                  fluxoMode === "manual"
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-text-muted"
                }`}
              />
              <div className="text-left">
                <p
                  className={`text-sm font-medium ${
                    fluxoMode === "manual"
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-text-primary"
                  }`}
                >
                  Informar manualmente
                </p>
                <p className="text-xs text-text-muted">
                  Adicione itens e quantidades por pessoa
                </p>
              </div>
            </button>
          </div>

          {/* Fluxo A: Recipe selection */}
          {fluxoMode === "recipe" && (
            <div className="space-y-3">
              {recipes.length === 0 ? (
                <div className="text-center py-6 text-text-muted">
                  <p className="text-sm">Nenhuma receita cadastrada</p>
                  <Link
                    href="/recipes/new"
                    className="text-primary-600 dark:text-primary-400 text-sm hover:underline"
                  >
                    Cadastrar receita →
                  </Link>
                </div>
              ) : (
                recipes.map((recipe) => {
                  const isSelected = selectedRecipes.some((r) => r.recipeId === recipe.id);
                  const selected = selectedRecipes.find((r) => r.recipeId === recipe.id);
                  const numConvidados = convidados ? parseInt(convidados) : recipe.rendimento_base;
                  const fator = numConvidados / recipe.rendimento_base;

                  return (
                    <div
                      key={recipe.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20"
                          : "border-border-default"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRecipe(recipe.id)}
                          className="w-4 h-4 text-primary-600 rounded border-border-default focus:ring-primary-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{recipe.nome}</p>
                          <p className="text-xs text-text-muted">
                            Rende {recipe.rendimento_base} porções
                          </p>
                        </div>
                      </div>
                      {isSelected && convidados && (
                        <div className="text-right">
                          <p className="text-xs text-text-muted">Escala</p>
                          <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            {fator.toFixed(1)}x ({numConvidados} porções)
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Fluxo B: Manual items */}
          {fluxoMode === "manual" && (
            <div className="space-y-3">
              {manualItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-3 items-end p-3 bg-bg-surface-alt rounded-lg"
                >
                  <div className="col-span-5">
                    <label className="block text-xs text-text-muted mb-1">Item</label>
                    <input
                      type="text"
                      value={item.nome}
                      onChange={(e) => updateManualItem(index, "nome", e.target.value)}
                      placeholder="Ex: panacota, arroz, frango..."
                      className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-xs text-text-muted mb-1">
                      Qtd por pessoa
                    </label>
                    <input
                      type="number"
                      value={item.quantidadePorPessoa}
                      onChange={(e) =>
                        updateManualItem(index, "quantidadePorPessoa", e.target.value)
                      }
                      placeholder="Ex: 50"
                      step="0.1"
                      min="0"
                      className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-xs text-text-muted mb-1">Unidade</label>
                    <select
                      value={item.unidade}
                      onChange={(e) => updateManualItem(index, "unidade", e.target.value)}
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
                      onClick={() => removeManualItem(index)}
                      disabled={manualItems.length === 1}
                      className="p-2 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600 dark:hover:text-danger-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addManualItem}
                className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                <Plus className="w-4 h-4" />
                Adicionar item
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/productions"
            className="px-6 py-2 border border-border-default rounded-lg text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-text-inverse rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Salvando..." : "Criar produção"}
          </button>
        </div>
      </form>
    </div>
  );
}
