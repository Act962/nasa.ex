/**
 * Cache in-memory de regras SP + Stars por org.
 * TTL de 5 minutos. Invalidacao explicita no admin save.
 * Sem Redis necessario — funciona para single-instance.
 */

import prisma from "@/lib/prisma";

interface SpRule { action: string; points: number; isActive: boolean; cooldownHours: number | null; popupTemplateId: string | null }
interface StarRule { action: string; stars: number; isActive: boolean; cooldownHours: number | null; popupTemplateId: string | null }

interface CacheEntry {
  spRules: SpRule[];
  starRules: StarRule[];
  loadedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60 * 1000; // 5 minutos

export async function getOrgRules(orgId: string): Promise<{ spRules: SpRule[]; starRules: StarRule[] }> {
  const existing = cache.get(orgId);
  if (existing && Date.now() - existing.loadedAt < TTL) {
    return { spRules: existing.spRules, starRules: existing.starRules };
  }

  const [spRules, starRules] = await Promise.all([
    prisma.spacePointRule.findMany({
      where: { orgId, isActive: true },
      select: { action: true, points: true, isActive: true, cooldownHours: true, popupTemplateId: true },
    }),
    prisma.starRule.findMany({
      where: { orgId, isActive: true },
      select: { action: true, stars: true, isActive: true, cooldownHours: true, popupTemplateId: true },
    }),
  ]);

  const entry: CacheEntry = { spRules, starRules, loadedAt: Date.now() };
  cache.set(orgId, entry);
  return { spRules, starRules };
}

export function invalidateOrgRules(orgId: string) {
  cache.delete(orgId);
}

export function invalidateAllRules() {
  cache.clear();
}
