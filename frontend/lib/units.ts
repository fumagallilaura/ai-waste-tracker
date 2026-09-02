/** Unit conversion utilities (mirrors backend). */

const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  kg: { base: "g", factor: 1000 },
  g: { base: "g", factor: 1 },
  L: { base: "ml", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  unidade: { base: "unidade", factor: 1 },
};

export function toBaseUnit(quantidade: number, unidade: string): [number, string] {
  const conversion = UNIT_CONVERSIONS[unidade];
  if (!conversion) {
    throw new Error(`Unidade não suportada: ${unidade}`);
  }
  return [quantidade * conversion.factor, conversion.base];
}

export function getDisplayUnit(baseQtd: number, baseUnit: string): [number, string] {
  if (baseUnit === "g" && baseQtd >= 1000) {
    return [baseQtd / 1000, "kg"];
  }
  if (baseUnit === "ml" && baseQtd >= 1000) {
    return [baseQtd / 1000, "L"];
  }
  return [baseQtd, baseUnit];
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatNumber(value: number, decimals: number = 1): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
