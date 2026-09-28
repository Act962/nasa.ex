import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { dispatchMoveLeadStatus } from "@/inngest/utils";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { TERMINAL_ORDER_STATUSES } from "@/features/trafego/lib/order-status";
import type { TrafegoColumnKey } from "@/features/trafego/lib/kanban-columns";
import { loadTrafegoSettings, statusIdForColumnKey } from "./trafego-settings";
import { computeTopOrder } from "./ensure-trafego-lead";

/**
 * Movimentos do card no tracking de operação feitos PELO PEDIDO (admin,
 * cliente, sistema). Nunca publicam no `eventBus` — é isso que impede o
 * subscriber do kanban de se reentrar (spec 0009 D-9).
 */

export interface LeadForDispatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trackingId: string;
  statusId: string;
  responsibleId: string | null;
  isActive: boolean;
}

export const LEAD_FOR_DISPATCH_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  trackingId: true,
  statusId: true,
  responsibleId: true,
  isActive: true,
} as const;

/** Pedido que o card espelha: o mais recente que ainda não terminou. */
export async function resolveCurrentOrderForLead(leadId: string) {
  return prisma.trafegoOrder.findFirst({
    where: { leadId, status: { notIn: TERMINAL_ORDER_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, status: true },
  });
}

interface ColumnMoveInTx {
  leadId: string;
  trackingId: string;
  statusId: string;
  previousStatusId: string;
  nickname?: string | null;
  actorUserId?: string | null;
  note?: string | null;
}

/** Escritas de banco do movimento — só isso pode rodar dentro da transação. */
export async function applyLeadColumnMoveInTx(
  tx: Prisma.TransactionClient,
  move: ColumnMoveInTx,
  now = new Date(),
): Promise<void> {
  const order = await computeTopOrder(tx, move.trackingId, move.statusId);
  await tx.lead.update({
    where: { id: move.leadId },
    data: {
      statusId: move.statusId,
      order,
      statusEnteredAt: now,
      lastStatusChangeAt: now,
      currentAction: "ACTIVE",
      closedAt: null,
      ...(move.nickname !== undefined ? { nickname: move.nickname } : {}),
    },
  });
  await tx.leadHistory.create({
    data: {
      leadId: move.leadId,
      action: "ACTIVE",
      eventType: "STATUS_CHANGE",
      previousStatusId: move.previousStatusId,
      newStatusId: move.statusId,
      userId: move.actorUserId ?? null,
      notes: move.note ?? null,
    },
  });
}

/** Cancelado/reembolsado: o card vira perdido em vez de mudar de coluna. */
export async function applyLeadLostInTx(
  tx: Prisma.TransactionClient,
  params: { leadId: string; nickname?: string | null; actorUserId?: string | null; note?: string | null },
  now = new Date(),
): Promise<void> {
  await tx.lead.update({
    where: { id: params.leadId },
    data: {
      currentAction: "LOST",
      closedAt: now,
      ...(params.nickname !== undefined ? { nickname: params.nickname } : {}),
    },
  });
  await tx.leadHistory.create({
    data: {
      leadId: params.leadId,
      action: "LOST",
      eventType: "ACTION_CHANGE",
      userId: params.actorUserId ?? null,
      notes: params.note ?? null,
    },
  });
}

/**
 * Efeitos pós-commit de um movimento: jornada + Pusher do lead e workflows
 * `MOVE_LEAD_STATUS` do tracking (mesma consulta de `leads.updateManyStatus`).
 */
export async function runLeadMoveSideEffects(params: {
  lead: LeadForDispatch;
  previousStatusId: string;
  newStatusId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<void> {
  await recordLeadEvent({
    leadId: params.lead.id,
    eventType: "STATUS_CHANGE",
    userId: params.actorUserId ?? null,
    previousStatusId: params.previousStatusId,
    newStatusId: params.newStatusId,
    notes: params.note ?? null,
  }).catch((error) => console.warn("[trafego/lead-card] recordLeadEvent falhou:", error));

  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        trackingId: params.lead.trackingId,
        isActive: true,
        nodes: {
          some: {
            type: "MOVE_LEAD_STATUS",
            data: { path: ["action", "statusId"], equals: params.newStatusId },
          },
        },
      },
      select: { id: true },
    });
    await Promise.all(
      workflows.map((workflow) =>
        dispatchMoveLeadStatus({
          workflowId: workflow.id,
          lead: { ...params.lead, statusId: params.newStatusId },
          previousLead: { ...params.lead, statusId: params.previousStatusId },
        }),
      ),
    );
  } catch (error) {
    console.warn("[trafego/lead-card] dispatch de workflows falhou:", error);
  }
}

export type MoveLeadOutcome = "moved" | "already_there" | "skipped";

/** Move o card de um lead para a coluna de uma chave (fora de transação). */
export async function moveTrafegoLeadToColumn(params: {
  leadId: string;
  columnKey: TrafegoColumnKey;
  nickname?: string | null;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<MoveLeadOutcome> {
  const settings = await loadTrafegoSettings();
  if (!settings.operationsTrackingId) return "skipped";
  const statusId = statusIdForColumnKey(settings, params.columnKey);
  if (!statusId) return "skipped";

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: LEAD_FOR_DISPATCH_SELECT,
  });
  if (!lead || lead.trackingId !== settings.operationsTrackingId) return "skipped";

  if (lead.statusId === statusId) {
    if (params.nickname !== undefined) {
      await prisma.lead.update({ where: { id: lead.id }, data: { nickname: params.nickname } });
    }
    return "already_there";
  }

  await prisma.$transaction((tx) =>
    applyLeadColumnMoveInTx(tx, {
      leadId: lead.id,
      trackingId: lead.trackingId,
      statusId,
      previousStatusId: lead.statusId,
      nickname: params.nickname,
      actorUserId: params.actorUserId,
      note: params.note,
    }),
  );

  await runLeadMoveSideEffects({
    lead,
    previousStatusId: lead.statusId,
    newStatusId: statusId,
    actorUserId: params.actorUserId,
    note: params.note,
  });
  return "moved";
}
