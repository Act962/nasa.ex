import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

/** Espera mais antiga que isso não é "agora" — vira lead parado, não atendimento pendente. */
export const WAITING_LEAD_LOOKBACK_HOURS = 12;

/**
 * Lead esperando resposta (spec 0029, RF-4): a última mensagem é dele, chegou nas últimas 12 h e ninguém
 * respondeu depois — resposta humana ou automática. Usado pelo alerta "lead esperando" e pela fila da
 * Órbita Station (spec 0121, D-1); mudar aqui muda os dois.
 */
export function waitingLeadWhere(now: number, minimumWaitMinutes = 0): Prisma.LeadWhereInput {
  return {
    currentAction: { not: "DELETED" },
    isArchived: false,
    lastInboundAt: {
      lte: new Date(now - minimumWaitMinutes * 60_000),
      gte: new Date(now - WAITING_LEAD_LOOKBACK_HOURS * 3_600_000),
    },
    conversation: { isNot: null },
    OR: [{ lastOutboundAt: null }, { lastOutboundAt: { lt: prisma.lead.fields.lastInboundAt } }],
  };
}
