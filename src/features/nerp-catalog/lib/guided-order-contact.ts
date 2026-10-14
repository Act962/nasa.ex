// Venda guiada (spec 0104, RF-0 / RF-0b / D-6): o atendimento começa na mensagem do cliente no WhatsApp.
import "server-only";
import prisma from "@/lib/prisma";
import type { CatalogOrderCustomer } from "../schemas/order-payload";
import { extractOrderCode } from "../utils/format-order";
import { CATALOG_INTENT_TAGS } from "./order-quote";
import { applyCatalogIntentTag, ensureIntentTagId, requestOrderQuote } from "./order-quote-actions";
import { resolveApprovalTemplates } from "./approvals/approval-rules";
import { firstNameOf } from "./approvals/approval-messages";
import { sendCustomerMessage } from "./approvals/approval-delivery";

const OPEN_ORDER_STATUSES = ["RECEIVED", "NEGOTIATING"] as const;
const CONTACT_REMINDER_KIND = "catalog_order_contact_reminder";
const REMINDER_FIRST_HOUR = 8;
const REMINDER_LAST_HOUR = 20;

async function removeAwaitingTag(organizationId: string, leadIds: string[]) {
  const tagId = await ensureIntentTagId(organizationId, "awaitingCustomer");
  await prisma.leadTag.deleteMany({ where: { leadId: { in: leadIds }, tagId } });
}

function awaitingTagFilter() {
  return { leadTags: { some: { tag: { slug: CATALOG_INTENT_TAGS.awaitingCustomer.slug } } } };
}

/** Pedido gravado: só marca o lead. Nada vai ao cliente até ele enviar o pedido pelo WhatsApp. */
export async function markOrderAwaitingCustomer(params: { organizationId: string; leadId: string }) {
  await applyCatalogIntentTag({ organizationId: params.organizationId, leadId: params.leadId, key: "awaitingCustomer" });
}

/**
 * Primeira mensagem do cliente depois do pedido: pelo código do texto pronto (vale mesmo vindo de outro número, CB-9)
 * ou, sem código, pelo pedido que aguarda neste lead (CB-11). Liga o pedido à conversa e dispara o fluxo
 * "chegada do pedido". Devolve `true` quando a mensagem foi dele — o Astro não responde a ela.
 */
export async function tryStartGuidedOrderFromInbound(params: { organizationId: string; leadId: string; text: string }): Promise<boolean> {
  const code = extractOrderCode(params.text);
  const order = code
    ? await prisma.catalogOrder.findFirst({
        where: {
          organizationId: params.organizationId,
          publicToken: { startsWith: code, mode: "insensitive" },
          status: { in: [...OPEN_ORDER_STATUSES] },
          lead: awaitingTagFilter(),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, leadId: true },
      })
    : await prisma.catalogOrder.findFirst({
        where: {
          organizationId: params.organizationId,
          leadId: params.leadId,
          status: { in: [...OPEN_ORDER_STATUSES] },
          lead: awaitingTagFilter(),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, leadId: true },
      });
  if (!order) return false;

  if (order.leadId !== params.leadId) {
    await prisma.catalogOrder.update({ where: { id: order.id }, data: { leadId: params.leadId } });
  }
  await removeAwaitingTag(params.organizationId, [...new Set([order.leadId, params.leadId])]);
  await applyCatalogIntentTag({ organizationId: params.organizationId, leadId: params.leadId, key: "orderReceived", shouldRetrigger: true });
  // O Astro não responde a esta mensagem: é aqui que a equipe fica sabendo que o pedido espera o valor.
  const conversation = await prisma.conversation.findFirst({ where: { leadId: params.leadId }, select: { id: true } });
  if (conversation) {
    await requestOrderQuote({ orderId: order.id, conversationId: conversation.id }).catch((error: unknown) =>
      console.error("[nerp-catalog/guided-order] aviso à equipe falhou", error),
    );
  }
  return true;
}

/** Minutos até as 8h (horário de Brasília) quando agora é tarde da noite ou madrugada; 0 em horário razoável. */
export function minutesUntilReminderHours(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  if (hour >= REMINDER_FIRST_HOUR && hour <= REMINDER_LAST_HOUR) return 0;
  const minutesNow = hour * 60 + minute;
  const firstMinute = REMINDER_FIRST_HOUR * 60;
  return minutesNow < firstMinute ? firstMinute - minutesNow : 24 * 60 - minutesNow + firstMinute;
}

/** O lead ainda espera o cliente enviar este pedido? (a tag sai quando a mensagem dele chega). */
export async function isOrderAwaitingCustomer(orderId: string): Promise<boolean> {
  const order = await prisma.catalogOrder.findFirst({
    where: { id: orderId, status: { in: [...OPEN_ORDER_STATUSES] }, lead: awaitingTagFilter() },
    select: { id: true },
  });
  return !!order;
}

/** RF-0b: o lembrete único ao cliente que não enviou o pedido. Chamado pela ação do fluxo pronto, nunca por cron. */
export async function sendContactReminder(orderId: string) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, organizationId: true, nerpSaleNumber: true, customer: true, leadId: true },
  });
  const conversation = await prisma.conversation.findFirst({ where: { leadId: order.leadId }, select: { id: true } });
  if (!conversation) return { isSent: false as const, reason: "no_conversation" };
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId: order.organizationId },
    select: { approvalTemplates: true },
  });
  const firstName = firstNameOf((order.customer as CatalogOrderCustomer).name);
  const saleNumber = String(order.nerpSaleNumber);
  return sendCustomerMessage({
    conversationId: conversation.id,
    senderName: "Astro",
    text: `Oi, ${firstName}! Seu pedido #${saleNumber} ficou guardado aqui. Pra loja te mandar o valor, é só tocar em Enviar pedido.`,
    buttons: [{ id: "enviar-pedido", title: "Enviar pedido" }],
    template: { name: resolveApprovalTemplates(integration?.approvalTemplates).orderAwaitingCustomer, bodyParameters: [firstName, saleNumber] },
    isWhatsappForced: true,
    metadata: { kind: CONTACT_REMINDER_KIND, catalogOrderId: order.id },
  });
}
