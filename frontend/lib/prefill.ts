/** Draft handoff between the import page and the new recipe form (browser only). */

export const RECIPE_PREFILL_KEY = "dz_recipe_prefill";

export interface PrefillIngredient {
  ingrediente: string;
  quantidade: string;
  unidade: string;
  preco_unitario: string;
}

export interface RecipePrefill {
  nome: string;
  rendimento_base: string;
  tipo: string;
  ingredients: PrefillIngredient[];
}

export function saveRecipePrefill(prefill: RecipePrefill): void {
  sessionStorage.setItem(RECIPE_PREFILL_KEY, JSON.stringify(prefill));
}

export function takeRecipePrefill(): RecipePrefill | null {
  const raw = sessionStorage.getItem(RECIPE_PREFILL_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(RECIPE_PREFILL_KEY);
  try {
    return JSON.parse(raw) as RecipePrefill;
  } catch {
    return null;
  }
}
