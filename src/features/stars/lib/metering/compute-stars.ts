// Cálculo puro do valor em ★ de um evento. Sem I/O — dá para raciocinar e testar isolado.

import type {
  ComputedCharge,
  MeterQuantity,
  PriceEntry,
} from "./types";

function resolveVariantValue(
  entry: PriceEntry,
  variant: string | undefined,
): { value: number | null; unknownVariant: boolean } {
  if (!variant || !entry.variantCosts) {
    return { value: null, unknownVariant: false };
  }
  const configured = entry.variantCosts[variant];
  if (typeof configured !== "number" || Number.isNaN(configured)) {
    return { value: null, unknownVariant: true };
  }
  return { value: configured, unknownVariant: false };
}

function applyVariant(
  baseValue: number,
  variantValue: number | null,
  entry: PriceEntry,
): number {
  if (variantValue === null) return baseValue;
  return entry.variantMode === "multiplier"
    ? baseValue * variantValue
    : variantValue;
}

/**
 * Converte uma ação — com quantidade e variante opcionais — em ★ a debitar.
 *
 * Arredonda para cima porque fração de ★ não existe, e o arredondamento para
 * baixo faria toda chamada pequena sair de graça.
 */
export function computeStars(
  entry: PriceEntry,
  quantity?: MeterQuantity,
  variant?: string,
): ComputedCharge {
  const empty = (skipReason: ComputedCharge["skipReason"]): ComputedCharge => ({
    stars: 0,
    cappedByMax: false,
    unknownVariant: false,
    skipReason,
  });

  if (entry.source === "missing") return empty("no_price");
  if (!entry.isEnabled) return empty("disabled");

  const { value: variantValue, unknownVariant } = resolveVariantValue(
    entry,
    variant,
  );

  // ── Custo fixo por evento ───────────────────────────────────────────────
  if (entry.unit === "call") {
    const fixedCost = applyVariant(entry.baseCost, variantValue, entry);
    if (fixedCost <= 0) return { ...empty("zero_cost"), unknownVariant };

    const capped =
      entry.maxCharge !== null && fixedCost > entry.maxCharge
        ? entry.maxCharge
        : fixedCost;

    return {
      stars: Math.ceil(capped),
      cappedByMax: capped !== fixedCost,
      unknownVariant,
      skipReason: null,
    };
  }

  // ── Custo por quantidade ────────────────────────────────────────────────
  if (!quantity) return { ...empty("quantity_missing"), unknownVariant };
  if (quantity.unit !== entry.unit) {
    return { ...empty("quantity_missing"), unknownVariant };
  }
  if (!Number.isFinite(quantity.amount) || quantity.amount <= 0) {
    return { ...empty("invalid_quantity"), unknownVariant };
  }

  const effectiveUnitCost = applyVariant(
    entry.unitCost ?? 0,
    variantValue,
    entry,
  );
  if (effectiveUnitCost <= 0) {
    return { ...empty("zero_cost"), unknownVariant };
  }

  const divisor = entry.unitDivisor > 0 ? entry.unitDivisor : 1;
  const rawStars = (effectiveUnitCost * quantity.amount) / divisor;
  const withMinimum = Math.max(Math.ceil(rawStars), entry.minCharge);

  const capped =
    entry.maxCharge !== null && withMinimum > entry.maxCharge
      ? entry.maxCharge
      : withMinimum;

  if (capped <= 0) return { ...empty("zero_cost"), unknownVariant };

  return {
    stars: capped,
    cappedByMax: capped !== withMinimum,
    unknownVariant,
    skipReason: null,
  };
}
