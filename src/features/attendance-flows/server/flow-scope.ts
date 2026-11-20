import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Fluxos de atendimento ativos que respondem num número: ligados a ele no FlowAstro ou criados dentro do funil. */
export function attendanceFlowsOfTrackingWhere(trackingId: string): Prisma.WorkflowWhereInput {
  return {
    kind: "ATTENDANCE",
    isActive: true,
    OR: [{ trackingId }, { trackingLinks: { some: { trackingId } } }],
  };
}

/** Números em que o fluxo responde. */
export function trackingIdsOfFlow(flow: { trackingId: string | null; trackingLinks: { trackingId: string }[] }): string[] {
  return [...new Set([...(flow.trackingId ? [flow.trackingId] : []), ...flow.trackingLinks.map((link) => link.trackingId)])];
}
