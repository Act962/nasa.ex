import "server-only";
import prisma from "@/lib/prisma";
import type { ComputedLeadMetrics } from "./compute-lead-metrics";
import type { AiLeadAudit } from "./audit-with-ai";

// Grava as métricas do lead — sempre fora de `$transaction` (Regra 18).

export async function saveLeadMetrics(params: {
  leadId: string;
  computed: ComputedLeadMetrics;
  aiAudit?: AiLeadAudit | null;
  /** A estimativa da IA acabou de ser feita (não é a antiga preservada). */
  isNewAiAudit?: boolean;
}) {
  const { computed, aiAudit } = params;
  const data = {
    purchasePotential: aiAudit?.purchasePotential ?? computed.purchasePotential,
    interestLevel: aiAudit?.interestLevel ?? computed.interestLevel,
    purchasesCount: computed.purchasesCount,
    interactionsPerMonth: computed.interactionsPerMonth,
    avgAttendanceSeconds: computed.avgAttendanceSeconds,
    interactionLossRate: computed.interactionLossRate,
    avgResponseSeconds: computed.avgResponseSeconds,
    qualityScore: computed.qualityScore,
    resolutionRate: computed.resolutionRate,
    confidence: computed.confidence,
    source: aiAudit ? ("AI" as const) : ("COMPUTED" as const),
    aiRationale: aiAudit?.rationale ?? null,
    computedAt: new Date(),
    ...(params.isNewAiAudit ? { aiAuditedAt: new Date() } : {}),
  };
  return prisma.leadMetrics.upsert({
    where: { leadId: params.leadId },
    create: { leadId: params.leadId, ...data },
    update: data,
  });
}

/**
 * Recalcula a partir dos dados, preservando a nota da IA quando ela existe:
 * a automação não pode apagar o que a auditoria por IA estimou.
 */
export async function refreshLeadMetrics(leadId: string, computed: ComputedLeadMetrics) {
  const existing = await prisma.leadMetrics.findUnique({
    where: { leadId },
    select: { source: true, purchasePotential: true, interestLevel: true, aiRationale: true },
  });
  const keepsAiEstimate = existing?.source === "AI" && computed.confidence < 40;
  return saveLeadMetrics({
    leadId,
    computed,
    aiAudit: keepsAiEstimate
      ? {
          purchasePotential: existing.purchasePotential,
          interestLevel: existing.interestLevel,
          rationale: existing.aiRationale ?? "",
        }
      : null,
  });
}
