import "server-only";
import prisma from "@/lib/prisma";
import { findAiResourceForUsage } from "@/features/ia/lib/ai-resources";
import { estimateOwnKeyCostBrl } from "@/features/ia/lib/ai-use-groups";

// Uso de IA de uma empresa por recurso (e por funil, no atendimento), a partir de `usage_event`
// (spec 0093, RF-10). Separa o que saiu da chave da empresa do que saiu da plataforma.

export interface ResourceUsage {
  calls: number;
  /** Custo do que rodou na chave da plataforma, cobrado em Stars. */
  platformCostBrl: number;
  /** Custo estimado do que rodou na chave da empresa (pelos tokens e pela tabela de preços). */
  ownKeyCostBrl: number;
  ownKeyCalls: number;
  costBrl: number;
  stars: number;
  /** Usos sem preço conhecido: o custo mostrado é parcial. */
  unpricedCalls: number;
}

export const EMPTY_USAGE: ResourceUsage = { calls: 0, platformCostBrl: 0, ownKeyCostBrl: 0, ownKeyCalls: 0, costBrl: 0, stars: 0, unpricedCalls: 0 };

export function addUsage(total: ResourceUsage, added: ResourceUsage): ResourceUsage {
  return {
    calls: total.calls + added.calls,
    platformCostBrl: total.platformCostBrl + added.platformCostBrl,
    ownKeyCostBrl: total.ownKeyCostBrl + added.ownKeyCostBrl,
    ownKeyCalls: total.ownKeyCalls + added.ownKeyCalls,
    costBrl: total.costBrl + added.costBrl,
    stars: total.stars + added.stars,
    unpricedCalls: total.unpricedCalls + added.unpricedCalls,
  };
}

export function usageKey(resourceId: string, trackingId?: string | null): string {
  return trackingId ? `${resourceId}:${trackingId}` : resourceId;
}

export async function loadAiUsage(organizationId: string, since: Date): Promise<{ usageByKey: Map<string, ResourceUsage>; unassigned: ResourceUsage }> {
  const usageRows = await prisma.usageEvent.groupBy({
    by: ["feature", "action", "trackingId", "modelId", "usingCustomKey"],
    where: { organizationId, createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { costBrl: true, starsCharged: true, inputTokens: true, outputTokens: true },
  });

  const usageByKey = new Map<string, ResourceUsage>();
  let unassigned = EMPTY_USAGE;
  for (const usageRow of usageRows) {
    const calls = usageRow._count._all;
    const cost = usageRow.usingCustomKey
      ? estimateOwnKeyCostBrl(usageRow.modelId, usageRow._sum.inputTokens ?? 0, usageRow._sum.outputTokens ?? 0)
      : usageRow._sum.costBrl === null
        ? null
        : Number(usageRow._sum.costBrl);
    const usage: ResourceUsage = {
      calls,
      platformCostBrl: usageRow.usingCustomKey ? 0 : (cost ?? 0),
      ownKeyCostBrl: usageRow.usingCustomKey ? (cost ?? 0) : 0,
      ownKeyCalls: usageRow.usingCustomKey ? calls : 0,
      costBrl: cost ?? 0,
      stars: usageRow._sum.starsCharged ?? 0,
      unpricedCalls: cost === null ? calls : 0,
    };
    const resource = findAiResourceForUsage(usageRow);
    if (!resource) {
      unassigned = addUsage(unassigned, usage);
      continue;
    }
    const key = usageKey(resource.id, resource.isPerTracking ? usageRow.trackingId : null);
    usageByKey.set(key, addUsage(usageByKey.get(key) ?? EMPTY_USAGE, usage));
  }
  return { usageByKey, unassigned };
}

/** Só dono e admin da empresa veem chaves e valores de IA. */
export async function isCompanyAiManager(organizationId: string, userId: string): Promise<boolean> {
  const member = await prisma.member.findFirst({ where: { organizationId, userId }, select: { role: true } });
  const role = member?.role?.toLowerCase();
  return role === "owner" || role === "admin";
}

export interface AverageReplyTokens {
  input: number;
  output: number;
  sampleCalls: number;
}

const AVERAGE_WINDOW_DAYS = 30;
/** Com menos usos que isto a média engana mais do que ajuda: a tela volta à conversa de exemplo. */
const MIN_CALLS_FOR_AVERAGE = 20;

/** Tamanho médio real de uma chamada de um recurso, nos últimos 30 dias (spec 0093, RF-9). */
export async function loadAverageReplyTokens(organizationId: string, usageFeatures: string[], trackingId?: string): Promise<AverageReplyTokens | null> {
  const average = await prisma.usageEvent.aggregate({
    where: {
      organizationId,
      feature: { in: usageFeatures },
      inputTokens: { gt: 0 },
      createdAt: { gte: new Date(Date.now() - AVERAGE_WINDOW_DAYS * 24 * 60 * 60_000) },
      ...(trackingId ? { trackingId } : {}),
    },
    _avg: { inputTokens: true, outputTokens: true },
    _count: { _all: true },
  });
  if (average._count._all < MIN_CALLS_FOR_AVERAGE || !average._avg.inputTokens) return null;
  return { input: Math.round(average._avg.inputTokens), output: Math.round(average._avg.outputTokens ?? 0), sampleCalls: average._count._all };
}
