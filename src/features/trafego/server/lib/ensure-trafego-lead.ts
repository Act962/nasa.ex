import "server-only";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/features/trafego/lib/phone";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { TERMINAL_ORDER_STATUSES } from "@/features/trafego/lib/order-status";
import type { TrafegoColumnKey } from "@/features/trafego/lib/kanban-columns";
import {
  loadTrafegoSettings,
  statusIdForColumnKey,
  type TrafegoOperationsSettings,
} from "./trafego-settings";

/**
 * O card do cliente no tracking de operação.
 *
 * Um lead por telefone por tracking (`@@unique([phone, trackingId])`): o card
 * nasce no "Continuar" do wizard e é reaproveitado em toda compra seguinte. O
 * telefone é normalizado igual ao `wa_id` do inbound — sem isso o comprovante
 * enviado pelo WhatsApp criaria um segundo card.
 */

type PrismaLike = Prisma.TransactionClient | typeof prisma;

// Menor `order` = topo da coluna (board ordena por [statusId, order] asc).
export async function computeTopOrder(
  client: PrismaLike,
  trackingId: string,
  statusId: string,
): Promise<Prisma.Decimal> {
  const top = await client.lead.findFirst({
    where: { trackingId, statusId },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  return top ? Prisma.Decimal.sub(top.order, 1000) : new Prisma.Decimal(1000);
}

export async function resolveColumnStatusId(
  settings: TrafegoOperationsSettings,
  trackingId: string,
  columnKey: TrafegoColumnKey,
): Promise<string | null> {
  const mapped = statusIdForColumnKey(settings, columnKey);
  if (mapped) return mapped;
  const firstColumn = await prisma.status.findFirst({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return firstColumn?.id ?? null;
}

async function hasOpenOrder(leadId: string): Promise<boolean> {
  const openOrders = await prisma.trafegoOrder.count({
    where: { leadId, status: { notIn: TERMINAL_ORDER_STATUSES } },
  });
  return openOrders > 0;
}

interface LeadIdentity {
  name: string;
  email: string | null;
  phone: string | null;
  description: string;
  nickname?: string | null;
}

interface EnsureLeadOptions {
  columnKey: TrafegoColumnKey;
  /**
   * Move o card para a coluna quando o lead já existe mas não tem pedido em
   * andamento (cliente antigo comprando de novo). Com pedido aberto, o card
   * fica onde está — a campanha atual é o que importa no kanban.
   */
  moveIfIdle: boolean;
}

const LEAD_SELECT = { id: true, email: true, statusId: true } as const;

/**
 * Card já existente no tracking, pelo telefone e, em último caso, pelo e-mail.
 *
 * Busca pelas duas grafias possíveis do telefone: se o cliente já mandou
 * mensagem antes de comprar, o card dele foi criado com o `wa_id` cru — que
 * para conta antiga não tem o 9º dígito que normalizamos aqui.
 */
export async function findLeadInTracking(
  trackingId: string,
  phone: string | null,
  email: string | null,
) {
  const byPhone = phone
    ? await prisma.lead.findFirst({
        where: { trackingId, phone: { in: waIdLookupVariants(phone) } },
        // Se as duas grafias já existirem como cards separados (estrago
        // anterior a esta busca), fica com o mais antigo: é o que carrega a
        // conversa e o histórico.
        orderBy: { createdAt: "asc" },
        select: LEAD_SELECT,
      })
    : null;
  if (byPhone) return byPhone;

  return email
    ? prisma.lead.findFirst({
        where: { trackingId, email: { equals: email, mode: "insensitive" } },
        select: LEAD_SELECT,
      })
    : null;
}

export async function ensureTrafegoLead(
  identity: LeadIdentity,
  options: EnsureLeadOptions,
): Promise<string | null> {
  const settings = await loadTrafegoSettings();
  const trackingId = settings.operationsTrackingId;
  if (!trackingId) {
    console.warn("[trafego/lead] operationsTrackingId não configurado — card não criado.");
    return null;
  }

  const statusId = await resolveColumnStatusId(settings, trackingId, options.columnKey);
  if (!statusId) {
    console.warn(`[trafego/lead] tracking ${trackingId} sem colunas — card não criado.`);
    return null;
  }

  const phone = normalizeWhatsappPhoneBr(identity.phone);
  const email = identity.email?.trim().toLowerCase() || null;

  const existing = await findLeadInTracking(trackingId, phone, email);

  const now = new Date();

  if (existing) {
    const shouldMove =
      options.moveIfIdle && existing.statusId !== statusId && !(await hasOpenOrder(existing.id));

    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...(identity.nickname !== undefined ? { nickname: identity.nickname } : {}),
        ...(!existing.email && email ? { email } : {}),
        ...(shouldMove
          ? {
              statusId,
              order: await computeTopOrder(prisma, trackingId, statusId),
              statusEnteredAt: now,
              lastStatusChangeAt: now,
              currentAction: "ACTIVE",
              closedAt: null,
            }
          : {}),
      },
    });
    return existing.id;
  }

  const created = await prisma.lead.create({
    data: {
      trackingId,
      statusId,
      name: identity.name,
      email,
      phone,
      description: identity.description,
      nickname: identity.nickname ?? null,
      source: "OTHER",
      statusEnteredAt: now,
      order: await computeTopOrder(prisma, trackingId, statusId),
    },
    select: { id: true },
  });
  return created.id;
}

const asText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Card em "Aguardando pagamento" — chamado assim que a compra pendente nasce. */
export async function ensureTrafegoLeadForPending(pendingId: string): Promise<string | null> {
  const pending = await prisma.trafegoPendingPurchase.findUnique({
    where: { id: pendingId },
    select: {
      id: true,
      email: true,
      phone: true,
      companyName: true,
      briefing: true,
      platform: true,
      adBudgetBrlCents: true,
      leadId: true,
    },
  });
  if (!pending) return null;
  if (pending.leadId) return pending.leadId;

  const briefing = (pending.briefing ?? {}) as Record<string, unknown>;
  const businessName = asText(briefing.businessName) ?? pending.companyName;

  const leadId = await ensureTrafegoLead(
    {
      name: businessName ?? pending.email,
      email: pending.email,
      phone: pending.phone,
      description: `trafeGO · ${PLATFORM_SHORT_LABEL[pending.platform]} · verba ${formatBrlFromCents(pending.adBudgetBrlCents)} · aguardando pagamento`,
    },
    { columnKey: "AWAITING_PAYMENT", moveIfIdle: true },
  );

  if (leadId) {
    await prisma.trafegoPendingPurchase.update({
      where: { id: pending.id },
      data: { leadId },
    });
  }
  return leadId;
}

/** Garante que o pedido tem card (herda o da compra) e que o card mostra o código. */
export async function ensureTrafegoLeadForOrder(orderId: string): Promise<string | null> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      status: true,
      leadId: true,
      businessName: true,
      whatsappNumber: true,
      platform: true,
      adBudgetBrlCents: true,
      owner: { select: { name: true, email: true, phone: true } },
      pendingPurchase: { select: { leadId: true, phone: true, email: true } },
    },
  });
  if (!order) return null;

  let leadId = order.leadId ?? order.pendingPurchase?.leadId ?? null;

  if (leadId) {
    await prisma.lead
      .update({ where: { id: leadId }, data: { nickname: order.code } })
      .catch(() => {
        // Lead apagado desde a compra — recria abaixo.
        leadId = null;
      });
  }

  if (!leadId) {
    leadId = await ensureTrafegoLead(
      {
        name: order.businessName ?? order.owner.name ?? order.owner.email,
        email: order.pendingPurchase?.email ?? order.owner.email,
        phone: order.pendingPurchase?.phone ?? order.owner.phone ?? order.whatsappNumber,
        description: `trafeGO ${order.code} · ${PLATFORM_SHORT_LABEL[order.platform]} · verba ${formatBrlFromCents(order.adBudgetBrlCents)}`,
        nickname: order.code,
      },
      { columnKey: order.status, moveIfIdle: false },
    );
  }

  if (leadId && leadId !== order.leadId) {
    await prisma.trafegoOrder.update({ where: { id: order.id }, data: { leadId } });
  }
  return leadId;
}
