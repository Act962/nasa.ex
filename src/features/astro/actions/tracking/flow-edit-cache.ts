import "server-only";
import { createHash } from "node:crypto";
import type { FlowEditPlan } from "@/features/workflows/lib/flow-edit-plan";

// Guarda o plano que o modelo propôs enquanto a pessoa responde às perguntas (spec 0094, RNF-1), para
// cada resposta não custar uma chamada nova. Em memória e por processo, como o ciclo guiado do Astro
// (`guided-slots.ts`): perder isso num restart só custa refazer a análise, nunca grava dado errado.

const PLAN_TTL_MS = 15 * 60_000;
const MAX_CACHED_PLANS = 200;

interface CachedPlan {
  plan: FlowEditPlan;
  expiresAt: number;
}

const globalForPlans = globalThis as unknown as { astroFlowEditPlans?: Map<string, CachedPlan> };
const cachedPlans = (globalForPlans.astroFlowEditPlans ??= new Map<string, CachedPlan>());

/** A chave amarra o plano a quem pediu, ao fluxo como ele estava e ao texto do pedido. */
export function flowEditPlanKey(params: { organizationId: string; userId: string; workflowId: string; workflowUpdatedAt: Date; request: string }): string {
  const requestHash = createHash("sha256").update(params.request).digest("hex").slice(0, 24);
  return [params.organizationId, params.userId, params.workflowId, params.workflowUpdatedAt.getTime(), requestHash].join(":");
}

export function readCachedFlowEditPlan(key: string): FlowEditPlan | null {
  const cached = cachedPlans.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    cachedPlans.delete(key);
    return null;
  }
  return cached.plan;
}

export function cacheFlowEditPlan(key: string, plan: FlowEditPlan): void {
  if (cachedPlans.size >= MAX_CACHED_PLANS) {
    const oldestKey = cachedPlans.keys().next().value;
    if (oldestKey) cachedPlans.delete(oldestKey);
  }
  cachedPlans.set(key, { plan, expiresAt: Date.now() + PLAN_TTL_MS });
}
