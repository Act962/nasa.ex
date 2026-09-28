import "server-only";
import prisma from "@/lib/prisma";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { AWAITING_PAYMENT_COLUMN_KEY } from "@/features/trafego/lib/kanban-columns";
import { columnKeyForStatusId, loadTrafegoSettings } from "./trafego-settings";
import { resolveCurrentOrderForLead } from "./lead-card";
import { transitionTrafegoOrder } from "./transition-order";

/**
 * Kanban → pedido. Quando um card do tracking de operação muda de coluna
 * (drag, seleção em massa, detalhe do lead), o pedido corrente daquele lead
 * recebe o status mapeado — com origem `KANBAN`, o que faz a transição NÃO
 * mover o card de volta.
 *
 * Registrado 1x por processo em `instrumentation.ts`, ao lado do alert-engine.
 */
interface LeadStatusChangedPayload {
  leadId: string;
  fromStatusId: string | null;
  toStatusId: string;
  orgId: string | null;
  responsibleId: string | null;
  actorUserId?: string | null;
}

let registered = false;

export function registerTrafegoSubscribers(): void {
  if (registered) return;
  registered = true;

  eventBus.subscribe<LeadStatusChangedPayload>("lead.status_changed", async (payload) => {
    try {
      await handleLeadStatusChanged(payload);
    } catch (error) {
      console.error("[trafego/kanban] sync do card falhou:", error);
    }
  });
}

async function handleLeadStatusChanged(payload: LeadStatusChangedPayload): Promise<void> {
  const settings = await loadTrafegoSettings();
  if (!settings.operationsTrackingId) return;

  const lead = await prisma.lead.findUnique({
    where: { id: payload.leadId },
    select: { trackingId: true, statusId: true },
  });
  if (!lead || lead.trackingId !== settings.operationsTrackingId) return;
  // O evento pode ter sido publicado antes de outro movimento — confia no banco.
  if (lead.statusId !== payload.toStatusId) return;

  const order = await resolveCurrentOrderForLead(payload.leadId);
  if (!order) return;

  const columnKey = columnKeyForStatusId(settings, payload.toStatusId);

  if (!columnKey) {
    const column = await prisma.status.findUnique({
      where: { id: payload.toStatusId },
      select: { name: true },
    });
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: "Card movido no tracking",
        detail: `Coluna "${column?.name ?? payload.toStatusId}" não tem status mapeado — o pedido continua em "${order.status}".`,
        isClientVisible: false,
        actorUserId: payload.actorUserId ?? null,
        source: "KANBAN",
      },
    });
    return;
  }

  // Dinheiro só se confirma pelo Stripe ou pelo "Confirmar PIX".
  if (columnKey === AWAITING_PAYMENT_COLUMN_KEY || columnKey === "PAID") return;

  await transitionTrafegoOrder({
    orderId: order.id,
    toStatus: columnKey,
    source: "KANBAN",
    actorUserId: payload.actorUserId ?? null,
  });
}
