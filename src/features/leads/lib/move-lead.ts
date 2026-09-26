import "server-only";
import prisma from "@/lib/prisma";
import { recordLeadEvent } from "./history";
import { computeSlaDeadline } from "./sla";
import { publishLeadMoved } from "@/features/leads/realtime/publish";
import {
  broadcastAgentWorkflowEvent,
  dispatchMoveLeadStatus,
} from "@/inngest/utils";

export type MoveLeadToStageInput = {
  leadId: string;
  toTrackingId: string;
  /** Sem status (ou status de outro tracking) → primeira coluna do destino. */
  toStatusId?: string | null;
};

export type MoveLeadToStageResult = {
  /** Lead que ficou no destino — pode ser outro quando o cliente já existia lá. */
  leadId: string;
  trackingId: string;
  statusId: string;
  mergedIntoExistingLead: boolean;
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

  if (movingLead.statusId !== targetStatus.id) {
    await recordLeadEvent({
      leadId: movingLead.id,
      eventType: "STATUS_CHANGE",
      previousStatusId: movingLead.statusId,
      newStatusId: targetStatus.id,
    });
  }
  if (movingLead.trackingId !== input.toTrackingId) {
    await recordLeadEvent({
      leadId: movingLead.id,
      eventType: "TRACKING_CHANGE",
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

  return {
    leadId: movingLead.id,
    trackingId: input.toTrackingId,
    statusId: targetStatus.id,
    mergedIntoExistingLead: !!leadAlreadyInTarget,
  };
}
