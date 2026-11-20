import "server-only";
import prisma from "@/lib/prisma";
import { recordLeadEvent } from "./history";
import { computeSlaDeadline } from "./sla";
import { publishLeadMoved } from "@/features/leads/realtime/publish";
import {
  broadcastAgentWorkflowEvent,
  dispatchMoveLeadStatus,
} from "@/inngest/utils";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { LeadAction } from "@/generated/prisma/enums";

export type MoveLeadToStageInput = {
  leadId: string;
  toTrackingId: string;
  /** Sem status (ou status de outro tracking) → primeira coluna do destino. */
  toStatusId?: string | null;
  /** Quem moveu (spec 0145). Sem ele é o sistema, como sempre foi. `via` é o nome da IA externa. */
  actor?: { id: string; name: string; email: string; image?: string | null; via?: string };
};

export type MoveLeadToStageResult = {
  /** Lead que ficou no destino — pode ser outro quando o cliente já existia lá. */
  leadId: string;
  trackingId: string;
  statusId: string;
  mergedIntoExistingLead: boolean;
  /** false quando o lead já estava nessa coluna (nenhum evento de mudança é publicado). */
  hasStatusChanged: boolean;
};

async function resolveTargetStatusId(trackingId: string, statusId?: string | null) {
  const status = statusId
    ? await prisma.status.findFirst({
        where: { id: statusId, trackingId },
        select: { id: true, slaHours: true },
      })
    : null;
  if (status) return status;
  const firstStatus = await prisma.status.findFirst({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true, slaHours: true },
  });
  if (!firstStatus) throw new Error("target_status_not_configured");
  return firstStatus;
}

// Movimentação feita pelo sistema (sem usuário): mesmo efeito colateral do
// arraste no board — histórico, board em tempo real, workflows MOVE_LEAD_STATUS
// do destino e o broadcast "lead-status-changed".
export async function moveLeadToStage(
  input: MoveLeadToStageInput,
): Promise<MoveLeadToStageResult> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: input.leadId },
    select: { id: true, phone: true, trackingId: true, statusId: true },
  });
  const targetStatus = await resolveTargetStatusId(input.toTrackingId, input.toStatusId);
  const isTrackingChange = lead.trackingId !== input.toTrackingId;

  // phone+tracking é único: cliente recorrente já tem lead no destino, e é
  // ele que avança — o lead de origem fica onde está.
  const leadAlreadyInTarget =
    isTrackingChange && lead.phone
      ? await prisma.lead.findUnique({
          where: { phone_trackingId: { phone: lead.phone, trackingId: input.toTrackingId } },
          select: { id: true, trackingId: true, statusId: true },
        })
      : null;
  const movingLead = leadAlreadyInTarget ?? lead;

  const firstLeadInStatus = await prisma.lead.findFirst({
    where: { statusId: targetStatus.id },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  const enteredAt = new Date();
  const updatedLead = await prisma.lead.update({
    where: { id: movingLead.id },
    data: {
      trackingId: input.toTrackingId,
      statusId: targetStatus.id,
      order: firstLeadInStatus ? Number(firstLeadInStatus.order) - 1 : 0,
      statusEnteredAt: enteredAt,
      lastStatusChangeAt: enteredAt,
      slaDeadline: computeSlaDeadline(targetStatus, enteredAt),
    },
  });

  if (!leadAlreadyInTarget && isTrackingChange) {
    try {
      await prisma.conversation.updateMany({
        where: { leadId: lead.id },
        data: { trackingId: input.toTrackingId },
      });
    } catch (error) {
      console.error("[move-lead] conversation_move_failed", error);
    }
  }

  const actorId = input.actor?.id ?? null;
  if (movingLead.statusId !== targetStatus.id) {
    await recordLeadEvent({
      leadId: movingLead.id,
      eventType: "STATUS_CHANGE",
      userId: actorId,
      previousStatusId: movingLead.statusId,
      newStatusId: targetStatus.id,
    });
  }
  if (movingLead.trackingId !== input.toTrackingId) {
    await recordLeadEvent({
      leadId: movingLead.id,
      eventType: "TRACKING_CHANGE",
      userId: actorId,
      previousTrackingId: movingLead.trackingId,
      newTrackingId: input.toTrackingId,
    });
  }

  await publishLeadMoved({
    leadId: movingLead.id,
    fromTrackingId: movingLead.trackingId,
    toTrackingId: input.toTrackingId,
    fromStatusId: movingLead.statusId,
    toStatusId: targetStatus.id,
    movedAt: enteredAt.toISOString(),
  }).catch((error) => console.error("[move-lead] publish_failed", error));

  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        trackingId: input.toTrackingId,
        isActive: true,
        nodes: {
          some: {
            type: "MOVE_LEAD_STATUS",
            data: { path: ["action", "statusId"], equals: targetStatus.id },
          },
        },
      },
      select: { id: true },
    });
    await Promise.all(
      workflows.map((workflow) =>
        dispatchMoveLeadStatus({
          workflowId: workflow.id,
          lead: updatedLead,
          previousLead: { id: movingLead.id, trackingId: movingLead.trackingId, statusId: movingLead.statusId },
        }),
      ),
    );
    await broadcastAgentWorkflowEvent({
      event: "lead-status-changed",
      leadId: movingLead.id,
      trackingId: input.toTrackingId,
      extra: { fromStatusId: movingLead.statusId, toStatusId: targetStatus.id },
    });
  } catch (error) {
    console.error("[move-lead] workflow_dispatch_failed", error);
  }

  const hasStatusChanged = movingLead.statusId !== targetStatus.id;
  if (hasStatusChanged) {
    // Mesmo evento do arrastar no board: alertas e etapas do pedido do catálogo (spec 0044) reagem igual.
    const tracking = await prisma.tracking.findUnique({ where: { id: input.toTrackingId }, select: { organizationId: true, name: true } });
    await eventBus.publish("lead.status_changed", {
      leadId: movingLead.id,
      fromStatusId: movingLead.statusId,
      toStatusId: targetStatus.id,
      orgId: tracking?.organizationId ?? null,
      responsibleId: updatedLead.responsibleId,
      actorUserId: actorId,
    });
    if (input.actor && tracking) await recordActorMove(input.actor, { lead: updatedLead, tracking, fromStatusId: movingLead.statusId, toStatusId: targetStatus.id });
  }

  return {
    leadId: movingLead.id,
    trackingId: input.toTrackingId,
    statusId: targetStatus.id,
    mergedIntoExistingLead: !!leadAlreadyInTarget,
    hasStatusChanged,
  };
}

/** Histórico do lead e de atividades com o nome de quem moveu, como o arraste no board grava. */
async function recordActorMove(
  actor: NonNullable<MoveLeadToStageInput["actor"]>,
  params: { lead: { id: string; name: string }; tracking: { organizationId: string; name: string }; fromStatusId: string; toStatusId: string },
) {
  const via = actor.via ? ` (via ${actor.via})` : "";
  try {
    const status = await prisma.status.findUnique({ where: { id: params.toStatusId }, select: { name: true } });
    await prisma.leadHistory.create({
      data: { leadId: params.lead.id, userId: actor.id, action: LeadAction.ACTIVE, notes: `Status do lead alterado${via}` },
    });
    await logActivity({
      organizationId: params.tracking.organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.moved",
      action: "lead.moved",
      actionLabel: `Moveu o lead "${params.lead.name}" para a coluna "${status?.name ?? params.toStatusId}"${via}`,
      resource: params.lead.name,
      resourceId: params.lead.id,
      metadata: { trackingName: params.tracking.name, fromStatusId: params.fromStatusId, toStatusId: params.toStatusId, ...(actor.via ? { via: actor.via } : {}) },
    });
  } catch (error) {
    console.error("[move-lead] actor_history_failed", error);
  }
}
