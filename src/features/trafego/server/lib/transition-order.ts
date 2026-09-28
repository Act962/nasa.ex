import "server-only";
import type { TrafegoOrderStatus, TrafegoTransitionSource } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { ORDER_STATUS_LABEL } from "@/features/trafego/lib/order-status";
import { LOST_ORDER_STATUSES } from "@/features/trafego/lib/kanban-columns";
import { loadTrafegoSettings, statusIdForColumnKey } from "./trafego-settings";
import {
  applyLeadColumnMoveInTx,
  applyLeadLostInTx,
  LEAD_FOR_DISPATCH_SELECT,
  runLeadMoveSideEffects,
} from "./lead-card";

/**
 * O ÚNICO caminho para mudar o status de um pedido.
 *
 * Numa transação (só escritas — CLAUDE.md regra 18): claim otimista do status
 * atual, evento com origem, timestamps do estágio, e o movimento do card no
 * tracking (a menos que a origem seja o próprio kanban — o card já está lá).
 * Depois do commit: jornada/workflows do lead, aviso ao cliente via Inngest e,
 * se a análise da conta terminou com materiais já prontos, a transição
 * encadeada para MATERIALS_SUBMITTED.
 *
 * O card é movido por `prisma.lead.update` direto e NUNCA pelo `eventBus`:
 * é isso que impede o subscriber do kanban de se reentrar (spec 0009 D-9).
 */
export interface TransitionTrafegoOrderInput {
  orderId: string;
  toStatus: TrafegoOrderStatus;
  source: TrafegoTransitionSource;
  actorUserId?: string | null;
  /** Recado para o cliente — vira `detail` do evento visível. */
  clientNote?: string | null;
  /** Nota só para a equipe — segundo evento, invisível ao cliente. */
  internalNote?: string | null;
  /** Título do evento visível. Default: rótulo do status. */
  title?: string;
  /** Claim atômico: só transiciona se o status atual estiver na lista. */
  expectedFrom?: TrafegoOrderStatus[];
  /** Guarda extra para fluxos do cliente: o pedido precisa ser desta org. */
  organizationId?: string;
}

export type TransitionTrafegoOrderResult =
  | { changed: true; fromStatus: TrafegoOrderStatus; eventId: string }
  | {
      changed: false;
      reason: "not_found" | "unchanged" | "claim_failed";
      fromStatus: TrafegoOrderStatus | null;
    };

function stageTimestamps(
  toStatus: TrafegoOrderStatus,
  durationDays: number,
  materialsSubmittedAt: Date | null,
  now: Date,
) {
  const data: Record<string, Date> = {};
  if (toStatus === "REQUESTED") data.requestedAt = now;
  if (toStatus === "MATERIALS_SUBMITTED" && !materialsSubmittedAt) data.materialsSubmittedAt = now;
  if (toStatus === "IN_REVIEW") data.approvedAt = now;
  if (toStatus === "RUNNING") {
    data.startedAt = now;
    data.endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }
  if (toStatus === "COMPLETED") data.completedAt = now;
  return data;
}

type CardPlan =
  | { kind: "none" }
  | { kind: "skip"; note: string }
  | { kind: "lose"; leadId: string }
  | { kind: "move"; leadId: string; trackingId: string; statusId: string; previousStatusId: string };

export async function transitionTrafegoOrder(
  input: TransitionTrafegoOrderInput,
): Promise<TransitionTrafegoOrderResult> {
  const order = await prisma.trafegoOrder.findFirst({
    where: {
      id: input.orderId,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    },
    select: {
      id: true,
      code: true,
      status: true,
      durationDays: true,
      leadId: true,
      materialsSubmittedAt: true,
      lead: { select: LEAD_FOR_DISPATCH_SELECT },
    },
  });
  if (!order) return { changed: false, reason: "not_found", fromStatus: null };
  if (order.status === input.toStatus) {
    return { changed: false, reason: "unchanged", fromStatus: order.status };
  }
  if (input.expectedFrom && !input.expectedFrom.includes(order.status)) {
    return { changed: false, reason: "claim_failed", fromStatus: order.status };
  }

  const now = new Date();
  const fromStatus = order.status;
  const settings = await loadTrafegoSettings();

  let card: CardPlan = { kind: "none" };
  if (input.source !== "KANBAN" && order.leadId && order.lead) {
    if (settings.operationsTrackingId && order.lead.trackingId !== settings.operationsTrackingId) {
      card = { kind: "skip", note: "Card está em outro tracking — não foi movido automaticamente." };
    } else if (LOST_ORDER_STATUSES.includes(input.toStatus)) {
      card = { kind: "lose", leadId: order.lead.id };
    } else {
      const statusId = statusIdForColumnKey(settings, input.toStatus);
      if (!statusId) {
        card = {
          kind: "skip",
          note: `Coluna "${ORDER_STATUS_LABEL[input.toStatus]}" não está mapeada no tracking de operação.`,
        };
      } else if (order.lead.statusId !== statusId) {
        card = {
          kind: "move",
          leadId: order.lead.id,
          trackingId: order.lead.trackingId,
          statusId,
          previousStatusId: order.lead.statusId,
        };
      }
    }
  }

  const title = input.title ?? ORDER_STATUS_LABEL[input.toStatus];
  const cardNote = `trafeGO ${order.code}: ${ORDER_STATUS_LABEL[input.toStatus]}`;

  const committed = await prisma.$transaction(async (tx) => {
    const claim = await tx.trafegoOrder.updateMany({
      where: { id: order.id, status: fromStatus },
      data: {
        status: input.toStatus,
        ...stageTimestamps(input.toStatus, order.durationDays, order.materialsSubmittedAt, now),
        ...(input.internalNote ? { internalNotes: input.internalNote } : {}),
      },
    });
    if (claim.count === 0) return null;

    const event = await tx.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus,
        toStatus: input.toStatus,
        title,
        detail: input.clientNote || null,
        isClientVisible: true,
        actorUserId: input.actorUserId ?? null,
        source: input.source,
      },
      select: { id: true },
    });

    if (input.internalNote) {
      await tx.trafegoOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus,
          toStatus: input.toStatus,
          title: "Nota interna",
          detail: input.internalNote,
          isClientVisible: false,
          actorUserId: input.actorUserId ?? null,
          source: input.source,
        },
      });
    }

    if (card.kind === "move") {
      await applyLeadColumnMoveInTx(
        tx,
        {
          leadId: card.leadId,
          trackingId: card.trackingId,
          statusId: card.statusId,
          previousStatusId: card.previousStatusId,
          nickname: order.code,
          actorUserId: input.actorUserId,
          note: cardNote,
        },
        now,
      );
    } else if (card.kind === "lose") {
      await applyLeadLostInTx(
        tx,
        { leadId: card.leadId, nickname: order.code, actorUserId: input.actorUserId, note: cardNote },
        now,
      );
    } else if (card.kind === "skip") {
      await tx.trafegoOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus,
          toStatus: input.toStatus,
          title: "Card não movido",
          detail: card.note,
          isClientVisible: false,
          source: "SYSTEM",
        },
      });
    }

    return { eventId: event.id };
  });

  if (!committed) return { changed: false, reason: "claim_failed", fromStatus };

  // ── Pós-commit, best-effort ──
  if (card.kind === "move" && order.lead) {
    await runLeadMoveSideEffects({
      lead: order.lead,
      previousStatusId: card.previousStatusId,
      newStatusId: card.statusId,
      actorUserId: input.actorUserId,
      note: cardNote,
    });
  }

  try {
    await inngest.send({
      name: "trafego/order.status-changed",
      data: { orderId: order.id, eventId: committed.eventId, fromStatus, toStatus: input.toStatus },
    });
  } catch (error) {
    console.error("[trafego/transition] dispatch Inngest falhou:", error);
  }

  // Conta liberada com materiais que o cliente já tinha enviado durante a análise.
  if (fromStatus === "ACCOUNT_REVIEW" && input.toStatus === "ONBOARDING" && order.materialsSubmittedAt) {
    await transitionTrafegoOrder({
      orderId: order.id,
      toStatus: "MATERIALS_SUBMITTED",
      source: "SYSTEM",
      expectedFrom: ["ONBOARDING"],
      clientNote: "Seus materiais já estavam prontos — a campanha pode ser ativada.",
    }).catch((error) => console.error("[trafego/transition] encadeamento falhou:", error));
  }

  return { changed: true, fromStatus, eventId: committed.eventId };
}
