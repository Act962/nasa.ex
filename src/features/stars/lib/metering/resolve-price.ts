// Resolução do preço de uma ação, em ordem de precedência (RF-1 da spec 0020).

import { CATALOG_DEFAULTS } from "./catalog-defaults";
import {
  getCatalog,
  getOrganizationOverrides,
  type CatalogRow,
} from "./catalog-cache";
import { PRICE_ENTRY_FALLBACK, type MeterUnit, type PriceEntry, type VariantMode } from "./types";

const KNOWN_UNITS: readonly MeterUnit[] = [
  "call",
  "token",
  "mb",
  "second",
  "minute",
  "image",
  "message",
];

function toUnit(value: string | null | undefined): MeterUnit {
  if (!value) return PRICE_ENTRY_FALLBACK.unit;
  return KNOWN_UNITS.includes(value as MeterUnit)
    ? (value as MeterUnit)
    : PRICE_ENTRY_FALLBACK.unit;
}

function toVariantMode(value: string | null | undefined): VariantMode {
  return value === "multiplier" ? "multiplier" : PRICE_ENTRY_FALLBACK.variantMode;
}

function fromCatalogRow(action: string, row: CatalogRow): PriceEntry {
  const shape = CATALOG_DEFAULTS[action];
  return {
    action,
    source: "catalog",
    baseCost: row.monthlyCost,
    unit: toUnit(row.unit ?? shape?.unit),
    unitCost: row.unitCost,
    unitDivisor: row.unitDivisor || shape?.unitDivisor || PRICE_ENTRY_FALLBACK.unitDivisor,
    minCharge: row.minCharge || shape?.minCharge || PRICE_ENTRY_FALLBACK.minCharge,
    maxCharge: row.maxCharge ?? shape?.maxCharge ?? null,
    variantCosts: row.variantCosts,
    variantMode: toVariantMode(row.variantMode ?? shape?.variantMode),
    allowBonus: row.allowBonus,
    isEnabled: row.isEnabled,
    displayName: row.displayName ?? shape?.displayName ?? null,
  };
}

function fromDefaults(action: string): PriceEntry | null {
  const shape = CATALOG_DEFAULTS[action];
  if (!shape) return null;
  return {
    action,
    source: "default",
    baseCost: 0,
    unit: shape.unit,
    unitCost: null,
    unitDivisor: shape.unitDivisor ?? PRICE_ENTRY_FALLBACK.unitDivisor,
    minCharge: shape.minCharge ?? PRICE_ENTRY_FALLBACK.minCharge,
    maxCharge: shape.maxCharge ?? null,
    variantCosts: null,
    variantMode: shape.variantMode ?? PRICE_ENTRY_FALLBACK.variantMode,
    allowBonus: shape.allowBonus ?? PRICE_ENTRY_FALLBACK.allowBonus,
    isEnabled: true,
    displayName: shape.displayName ?? null,
  };
}

function missingEntry(action: string): PriceEntry {
  return {
    action,
    source: "missing",
    baseCost: 0,
    unit: PRICE_ENTRY_FALLBACK.unit,
    unitCost: null,
    unitDivisor: PRICE_ENTRY_FALLBACK.unitDivisor,
    minCharge: PRICE_ENTRY_FALLBACK.minCharge,
    maxCharge: null,
    variantCosts: null,
    variantMode: PRICE_ENTRY_FALLBACK.variantMode,
    allowBonus: PRICE_ENTRY_FALLBACK.allowBonus,
    isEnabled: true,
    displayName: null,
  };
}

/**
 * Ordem: sobrescrita da organização → catálogo global → padrão no código →
 * ausente. A sobrescrita só carrega valor fixo, então herda a forma da camada
 * de baixo — é override de preço, não de unidade.
 */
export async function resolvePrice(
  organizationId: string,
  action: string,
): Promise<PriceEntry> {
  const [catalog, overrides] = await Promise.all([
    getCatalog(),
    getOrganizationOverrides(organizationId),
  ]);

  const catalogRow = catalog.get(action);
  const baseEntry = catalogRow
    ? fromCatalogRow(action, catalogRow)
    : (fromDefaults(action) ?? missingEntry(action));

  const override = overrides.get(action);
  if (!override) return baseEntry;

  return baseEntry.unit === "call"
    ? { ...baseEntry, source: "override", baseCost: override.stars }
    : { ...baseEntry, source: "override", unitCost: override.stars };
}
