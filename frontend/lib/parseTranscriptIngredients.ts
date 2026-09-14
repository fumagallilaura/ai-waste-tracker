/** Parse spoken ingredient lists into form rows — local heuristics, no LLM. */

const WORD_NUMBERS: Record<string, string> = {
  um: "1",
  uma: "1",
  dois: "2",
  duas: "2",
  tres: "3",
  três: "3",
  quatro: "4",
  cinco: "5",
  seis: "6",
  sete: "7",
  oito: "8",
  nove: "9",
  dez: "10",
  meio: "0.5",
  meia: "0.5",
};

const DIRECT_UNITS: Record<string, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  L: "L",
  un: "unidade",
  unidade: "unidade",
  unidades: "unidade",
  grama: "g",
  gramas: "g",
  quilo: "kg",
  quilos: "kg",
  litro: "L",
  litros: "L",
  mililitro: "ml",
  mililitros: "ml",
};

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
};

const HOUSEHOLD: { re: RegExp; factor: number; unit: string }[] = [
  { re: /^colher(?:es)?\s+(?:de\s+)?sopa|^colherada(?:s)?/i, factor: 15, unit: "g" },
  { re: /^colher(?:es)?\s+(?:de\s+)?sobremesa/i, factor: 10, unit: "g" },
  { re: /^colher(?:es)?\s+(?:de\s+)?ch[aá]/i, factor: 5, unit: "g" },
  { re: /^colher(?:es)?\b/i, factor: 1, unit: "unidade" },
  { re: /^x[ií]cara(?:s)?(?:\s+de\s+ch[aá])?|^x[ií]cs?\.?/i, factor: 240, unit: "ml" },
  { re: /^copo(?:s)?/i, factor: 200, unit: "ml" },
  { re: /^lata(?:s)?/i, factor: 1, unit: "unidade" },
  { re: /^dente(?:s)?\b/i, factor: 1, unit: "unidade" },
  { re: /^pitada(?:s)?/i, factor: 1, unit: "g" },
];

const FILLER_PREFIX =
  /^\s*((?:a|na|da)?\s*receita\s+(?:vai|leva)?|(?:vai|leva|coloca|adicione|adicionei|preciso\s+de|tem)\s*)+/i;

const QTY_RE =
  /^\s*((?:\s*(?:\d+\s*[/-]\s*\d+|\d+[.,]?\d*|½|⅓|⅔|¼|¾)){1,2})/;

/** Quantity token start inside continuous speech (after word-number expand). */
const QTY_START =
  /(?:^|(?<=\s))(?:\d+[.,]?\d*(?:\s+\d+\s*[/-]\s*\d+)?|\d+\s*[/-]\s*\d+|½|⅓|⅔|¼|¾)(?=\s|$|[.,;])/g;

export type ParsedIngredient = {
  ingrediente: string;
  quantidade: number;
  unidade: string;
  preco_unitario: null;
};

function toFloat(token: string): number {
  const parts = token.trim().split(/\s+/);
  let total = 0;
  let matched = false;
  for (const part of parts) {
    if (part in FRACTIONS) {
      total += FRACTIONS[part];
      matched = true;
      continue;
    }
    const frac = part.match(/^(\d+)\s*[/-]\s*(\d+)$/);
    if (frac) {
      total += Number(frac[1]) / Number(frac[2]);
      matched = true;
      continue;
    }
    if (/^\d+[.,]?\d*$/.test(part)) {
      total += Number(part.replace(",", "."));
      matched = true;
    }
  }
  if (!matched) throw new Error(`Not a quantity: ${token}`);
  return total;
}

function stripDe(name: string): string {
  return name.replace(/^(de|do|da|d')\s+/i, "").trim();
}

function parseOne(text: string): ParsedIngredient | null {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return null;

  const match = raw.match(QTY_RE);
  if (!match) {
    return { ingrediente: raw, quantidade: 1, unidade: "unidade", preco_unitario: null };
  }

  let quantity: number;
  try {
    quantity = toFloat(match[1]);
  } catch {
    return null;
  }
  const rest = raw.slice(match[0].length).trim();
  if (!rest) {
    return { ingrediente: raw, quantidade: quantity, unidade: "unidade", preco_unitario: null };
  }

  const lower = rest.toLowerCase();
  for (const rule of HOUSEHOLD) {
    const m = lower.match(rule.re);
    if (m && (m[0].length === lower.length || !/[a-zà-ú]/i.test(lower[m[0].length] || ""))) {
      const ingredient = stripDe(rest.slice(m[0].length).trim()) || rest.slice(0, m[0].length);
      return {
        ingrediente: ingredient,
        quantidade: Math.round(quantity * rule.factor * 1000) / 1000,
        unidade: rule.unit,
        preco_unitario: null,
      };
    }
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  const head = (tokens[0] || "").replace(/\.$/, "").toLowerCase();
  if (head in DIRECT_UNITS) {
    const ingredient = stripDe(tokens.slice(1).join(" ")) || raw;
    return {
      ingrediente: ingredient,
      quantidade: quantity,
      unidade: DIRECT_UNITS[head],
      preco_unitario: null,
    };
  }

  return {
    ingrediente: rest,
    quantidade: quantity,
    unidade: "unidade",
    preco_unitario: null,
  };
}

function expandWordNumbers(text: string): string {
  return text
    .split(/\s+/)
    .map((tok) => WORD_NUMBERS[tok.toLowerCase().replace(/[.,;]$/, "")] ?? tok)
    .join(" ");
}

/**
 * Split continuous speech on every quantity boundary.
 * "ovo 1 xícara de farinha 1 xícara de leite"
 * → ["1 ovo", "1 xícara de farinha", "1 xícara de leite"]
 */
function splitChunks(transcript: string): string[] {
  let cleaned = transcript.trim().replace(FILLER_PREFIX, "");
  cleaned = expandWordNumbers(cleaned);
  cleaned = cleaned.replace(/[,;]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const starts: number[] = [];
  QTY_START.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QTY_START.exec(cleaned)) !== null) {
    starts.push(m.index);
  }
  if (starts.length === 0) return [];

  const chunks: string[] = [];
  const leading = cleaned.slice(0, starts[0]).trim();
  if (leading && !/^(e|mais|de|do|da|com)(\s+(e|mais))?$/i.test(leading)) {
    chunks.push(`1 ${leading}`);
  }

  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : cleaned.length;
    let piece = cleaned.slice(starts[i], end).trim().replace(/^[,;.]+|[,;.]+$/g, "");
    piece = piece.replace(/\s+(e|mais)$/i, "").trim();
    if (piece) chunks.push(piece);
  }
  return chunks;
}

/** Turn a voice transcript into ingredient rows for the recipe form. */
export function parseTranscriptIngredients(transcript: string): ParsedIngredient[] {
  const out: ParsedIngredient[] = [];
  for (const chunk of splitChunks(transcript).slice(0, 50)) {
    const raw = chunk.trim().replace(/\s+/g, " ");
    if (!QTY_RE.test(raw)) continue;
    const row = parseOne(chunk);
    if (!row || !row.ingrediente.trim() || row.quantidade <= 0) continue;
    out.push({
      ...row,
      ingrediente: row.ingrediente.slice(0, 255),
      quantidade: Math.round(row.quantidade * 1000) / 1000,
    });
  }
  return out;
}
