// Medidas dos campos numéricos e dos itens de lista (spec 0075). Puro: usado
// pelos blocos, pelo servidor e pelo script de QA.

export interface MeasureUnit {
  id: string;
  label: string;
  symbol: string;
  /** Casas decimais aceitas na digitação e mostradas na leitura. */
  decimals: number;
  /** Família para conversão; unidades de famílias diferentes não convertem. */
  family: "count" | "volume" | "mass" | "length" | "area" | "time" | "currency";
  /** Quantas unidades-base da família uma unidade desta vale (ml, g, m…). */
  baseFactor: number;
}

export const CURRENCY_UNIT_ID = "brl";
export const CUSTOM_UNIT_ID = "custom";

export const MEASURE_UNITS: MeasureUnit[] = [
  { id: "un", label: "Unidade", symbol: "un", decimals: 0, family: "count", baseFactor: 1 },
  { id: "cx", label: "Caixa", symbol: "cx", decimals: 0, family: "count", baseFactor: 1 },
  { id: "par", label: "Par", symbol: "par", decimals: 0, family: "count", baseFactor: 1 },
  { id: "ml", label: "Mililitro", symbol: "ml", decimals: 0, family: "volume", baseFactor: 1 },
  { id: "l", label: "Litro", symbol: "L", decimals: 3, family: "volume", baseFactor: 1000 },
  { id: "g", label: "Grama", symbol: "g", decimals: 0, family: "mass", baseFactor: 1 },
  { id: "kg", label: "Quilo", symbol: "kg", decimals: 3, family: "mass", baseFactor: 1000 },
  { id: "m", label: "Metro", symbol: "m", decimals: 2, family: "length", baseFactor: 1 },
  { id: "m2", label: "Metro quadrado", symbol: "m²", decimals: 2, family: "area", baseFactor: 1 },
  { id: "h", label: "Hora", symbol: "h", decimals: 2, family: "time", baseFactor: 1 },
  { id: CURRENCY_UNIT_ID, label: "Reais (R$)", symbol: "R$", decimals: 2, family: "currency", baseFactor: 1 },
];

export function findMeasureUnit(unitId: string | null | undefined): MeasureUnit | null {
  if (!unitId) return null;
  const normalized = unitId.trim().toLowerCase();
  return (
    MEASURE_UNITS.find((unit) => unit.id === normalized) ??
    MEASURE_UNITS.find((unit) => unit.symbol.toLowerCase() === normalized) ??
    null
  );
}

/** "1.250,50", "1250.5", "R$ 12" → número; `null` quando não é número. */
export function parseDecimalInput(rawText: string): number | null {
  const digits = rawText.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(digits)) return null;
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits.replace(/\.(?=\d{3}(\D|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundToDecimals(amount: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "12,5 ml", "R$ 1.250,50", "3 un"; unidade desconhecida é mostrada como veio. */
export function formatMeasure(amount: number, unitSymbolOrId: string): string {
  const unit = findMeasureUnit(unitSymbolOrId);
  if (unit?.family === "currency") return formatCents(Math.round(amount * 100));
  const decimals = unit?.decimals ?? 2;
  const formatted = amount.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  const symbol = unit?.symbol ?? unitSymbolOrId.trim();
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/** Converte entre unidades da mesma família (ml ↔ L, g ↔ kg); `null` se não der. */
export function convertMeasure(amount: number, fromUnitId: string, toUnitId: string): number | null {
  const fromUnit = findMeasureUnit(fromUnitId);
  const toUnit = findMeasureUnit(toUnitId);
  if (!fromUnit || !toUnit || fromUnit.family !== toUnit.family) return null;
  if (fromUnit.family === "count" && fromUnit.id !== toUnit.id) return null;
  return (amount * fromUnit.baseFactor) / toUnit.baseFactor;
}
