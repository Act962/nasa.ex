/**
 * Cache in-memory do catálogo de preço de Stars.
 * TTL de 5 minutos, invalidação explícita quando o admin salva.
 *
 * Existe porque toda cobrança fazia uma consulta ao banco: com ~87 pontos de
 * cobrança, medir sairia caro. Mesmo formato de `rules-cache.ts`.
 */

import prisma from "@/lib/prisma";

export interface CatalogRow {
  appSlug: string;
  monthlyCost: number;
  displayName: string | null;
  unit: string | null;
  unitCost: number | null;
  unitDivisor: number;
  minCharge: number;
  maxCharge: number | null;
  variantCosts: Record<string, number> | null;
  variantMode: string | null;
  allowBonus: boolean;
  isEnabled: boolean;
}

export interface OverrideRow {
  action: string;
  stars: number;
}

const TTL = 5 * 60 * 1000;

let globalCatalog: { rows: Map<string, CatalogRow>; loadedAt: number } | null =
  null;

const overrideCache = new Map<
  string,
  { rows: Map<string, OverrideRow>; loadedAt: number }
>();

function toVariantCosts(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) parsed[key] = raw;
  }
  return Object.keys(parsed).length > 0 ? parsed : null;
}

export async function getCatalog(): Promise<Map<string, CatalogRow>> {
  if (globalCatalog && Date.now() - globalCatalog.loadedAt < TTL) {
    return globalCatalog.rows;
  }

  const records = await prisma.appStarCost.findMany({
    select: {
      appSlug: true,
      monthlyCost: true,
      displayName: true,
      unit: true,
      unitCost: true,
      unitDivisor: true,
      minCharge: true,
      maxCharge: true,
      variantCosts: true,
      variantMode: true,
      allowBonus: true,
      isEnabled: true,
    },
  });

  const rows = new Map<string, CatalogRow>();
  for (const record of records) {
    rows.set(record.appSlug, {
      appSlug: record.appSlug,
      monthlyCost: record.monthlyCost,
      displayName: record.displayName,
      unit: record.unit,
      unitCost: record.unitCost === null ? null : Number(record.unitCost),
      unitDivisor: record.unitDivisor,
      minCharge: record.minCharge,
      maxCharge: record.maxCharge,
      variantCosts: toVariantCosts(record.variantCosts),
      variantMode: record.variantMode,
      allowBonus: record.allowBonus,
      isEnabled: record.isEnabled,
    });
  }

  globalCatalog = { rows, loadedAt: Date.now() };
  return rows;
}

/**
 * Sobrescritas de preço da organização. Só linhas marcadas como override entram —
 * as demais continuam sem efeito sobre o preço (D-4 da spec 0020).
 */
export async function getOrganizationOverrides(
  organizationId: string,
): Promise<Map<string, OverrideRow>> {
  const cached = overrideCache.get(organizationId);
  if (cached && Date.now() - cached.loadedAt < TTL) return cached.rows;

  const records = await prisma.starRule.findMany({
    where: { orgId: organizationId, isActive: true, isOverride: true },
    select: { action: true, stars: true },
  });

  const rows = new Map<string, OverrideRow>();
  for (const record of records) rows.set(record.action, record);

  overrideCache.set(organizationId, { rows, loadedAt: Date.now() });
  return rows;
}

export function invalidateCatalog() {
  globalCatalog = null;
}

export function invalidateOrganizationOverrides(organizationId: string) {
  overrideCache.delete(organizationId);
}

export function invalidateAllOverrides() {
  overrideCache.clear();
}
