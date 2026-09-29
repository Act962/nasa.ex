import "server-only";
import prisma from "@/lib/prisma";
import { eventBus } from "@/features/alerts/lib/event-bus";

// Caminhos que trocam a coluna direto no banco (Astro, IA, executor de automação) publicam o mesmo
// evento do arrastar no board, para alertas e etapas do pedido do catálogo reagirem (spec 0044).
export async function publishLeadStatusChanged(params: {
  leadId: string;
  fromStatusId: string | null;
  toStatusId: string;
  actorUserId?: string | null;
}) {
  if (params.fromStatusId === params.toStatusId) return;
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      select: { responsibleId: true, tracking: { select: { organizationId: true } } },
    });
    await eventBus.publish("lead.status_changed", {
      leadId: params.leadId,
      fromStatusId: params.fromStatusId,
      toStatusId: params.toStatusId,
      orgId: lead?.tracking.organizationId ?? null,
      responsibleId: lead?.responsibleId ?? null,
      actorUserId: params.actorUserId ?? null,
    });
  } catch (error) {
    console.error("[leads] publish_status_changed_failed", error);
  }
}
