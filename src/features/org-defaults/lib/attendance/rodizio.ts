import type { Prisma } from "@/generated/prisma/client";
import { isAttendanceStateEnabled } from "./flag";

// Rodízio com o estado de atendimento (spec 0113, D-1). O `statusFlow` passa a ser o estado ao vivo da
// conversa e `isActive` só "a IA pode responder agora"; por isso a fila e a capacidade deixam de usar os dois
// como antes. Sem o interruptor, as regras antigas continuam iguais.

/** Leads que ocupam a capacidade dos consultores do funil (sem filtrar o consultor). */
export function consultantLoadFilter(params: { organizationId: string; trackingId: string }): Prisma.LeadWhereInput {
  if (!isAttendanceStateEnabled(params.organizationId)) {
    return { trackingId: params.trackingId, statusFlow: "ACTIVE", isActive: true };
  }
  return { trackingId: params.trackingId, ...liveConversationWhere() };
}

/** Leads que ocupam a capacidade do consultor. */
export function consultantLoadWhere(params: {
  organizationId: string;
  trackingId: string;
  responsibleId: string;
}): Prisma.LeadWhereInput {
  if (!isAttendanceStateEnabled(params.organizationId)) {
    return { responsibleId: params.responsibleId, trackingId: params.trackingId, isActive: true };
  }
  return { responsibleId: params.responsibleId, ...consultantLoadFilter(params) };
}

const LIVE_CONVERSATION_MS = 24 * 60 * 60_000;

/**
 * Conversa viva: cliente escreveu nas últimas 24 h, ou o lead chegou nas últimas 24 h sem mensagem (formulário,
 * cadastro, API). Lead antigo parado não pesa na carga nem volta para a fila.
 */
function liveConversationWhere(): Prisma.LeadWhereInput {
  const liveSince = new Date(Date.now() - LIVE_CONVERSATION_MS);
  return {
    statusFlow: { in: ["WAITING", "ACTIVE"] },
    OR: [{ lastInboundAt: { gte: liveSince } }, { lastInboundAt: null, createdAt: { gte: liveSince } }],
    currentAction: "ACTIVE",
    isArchived: false,
  };
}

/** Leads na fila esperando consultor. */
export function rodizioQueueWhere(params: { organizationId: string; trackingId: string }): Prisma.LeadWhereInput {
  if (!isAttendanceStateEnabled(params.organizationId)) {
    return { trackingId: params.trackingId, statusFlow: "WAITING", isActive: true };
  }
  // Inclui conversa que a IA já atende ("Em atendimento" sem consultor): ela continua precisando de alguém.
  return {
    trackingId: params.trackingId,
    responsibleId: null,
    ...liveConversationWhere(),
  };
}

/** Com o estado ao vivo, atribuir consultor não muda o estado da conversa. */
export function assignedStatusFlowPatch(organizationId: string): { statusFlow?: "ACTIVE" } {
  return isAttendanceStateEnabled(organizationId) ? {} : { statusFlow: "ACTIVE" };
}

export function queuedStatusFlowPatch(organizationId: string): { statusFlow?: "WAITING" } {
  return isAttendanceStateEnabled(organizationId) ? {} : { statusFlow: "WAITING" };
}
