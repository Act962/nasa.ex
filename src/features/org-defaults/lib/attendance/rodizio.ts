import type { Prisma } from "@/generated/prisma/client";
import { isAttendanceStateEnabled } from "./flag";

// Rodízio com o estado de atendimento (spec 0113, D-1). O `statusFlow` passa a ser o estado ao vivo da
// conversa e `isActive` só "a IA pode responder agora"; por isso a fila e a capacidade deixam de usar os dois
// como antes. Sem o interruptor, as regras antigas continuam iguais.

/** Leads que ocupam a capacidade do consultor. */
export function consultantLoadWhere(params: {
  organizationId: string;
  trackingId: string;
  responsibleId: string;
}): Prisma.LeadWhereInput {
  if (!isAttendanceStateEnabled(params.organizationId)) {
    return { responsibleId: params.responsibleId, trackingId: params.trackingId, isActive: true };
  }
  return {
    responsibleId: params.responsibleId,
    trackingId: params.trackingId,
    statusFlow: { not: "FINISHED" },
    currentAction: "ACTIVE",
    isArchived: false,
  };
}

/** Leads na fila esperando consultor. */
export function rodizioQueueWhere(params: { organizationId: string; trackingId: string }): Prisma.LeadWhereInput {
  if (!isAttendanceStateEnabled(params.organizationId)) {
    return { trackingId: params.trackingId, statusFlow: "WAITING", isActive: true };
  }
  return {
    trackingId: params.trackingId,
    statusFlow: "WAITING",
    responsibleId: null,
    currentAction: "ACTIVE",
    isArchived: false,
  };
}

/** Com o estado ao vivo, atribuir consultor não muda o estado da conversa. */
export function assignedStatusFlowPatch(organizationId: string): { statusFlow?: "ACTIVE" } {
  return isAttendanceStateEnabled(organizationId) ? {} : { statusFlow: "ACTIVE" };
}

export function queuedStatusFlowPatch(organizationId: string): { statusFlow?: "WAITING" } {
  return isAttendanceStateEnabled(organizationId) ? {} : { statusFlow: "WAITING" };
}
