import "server-only";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { handOverToAi } from "@/features/org-defaults/lib/attendance/state";
import { LeadSource, MessageStatus } from "@/generated/prisma/enums";
import {
  createInChatLead,
  firePostInboundAutomations,
} from "@/features/tracking-chat/lib/incoming-message-pipeline";
import { publishLeadCreated } from "@/features/leads/realtime/publish";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import type {
  NerpCatalogOrderPayload,
  NerpCatalogOrderResponse,
} from "../schemas/order-payload";
import {
  buildOrderPortalUrl,
  buildOrderSummaryText,
  buildOrderWhatsappUrl,
  toWhatsappPhone,
} from "../utils/format-order";
import { CATALOG_ORDER_MESSAGE_PREFIX } from "./order-channel";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { sendCustomerMessage } from "./approvals/approval-delivery";
import { markOrderAwaitingCustomer } from "./guided-order-contact";
import { resolveApprovalTemplates } from "./approvals/approval-rules";
import { toLeadAmountCents } from "../utils/format-order";
import { handleCatalogStageEntry } from "./stage-flow";
import { applyCatalogIntentTag } from "./order-quote-actions";
import { hasActiveSalesApprovers } from "./approvals/order-approvals";

export class CatalogIntegrationInactiveError extends Error {
  constructor() {
    super("catalog_integration_inactive");
    this.name = "CatalogIntegrationInactiveError";
  }
}

type OrderLead = {
  id: string;
  isActive: boolean;
  firstResponseAt: Date | null;
  lastInboundAt: Date | null;
  conversation: { id: string };
  isNew: boolean;
  statusId: string;
};

function buildResponse(input: {
  publicToken: string;
  saleNumber: number;
  whatsappNumber: string | null;
}): NerpCatalogOrderResponse {
  return {
    orderToken: input.publicToken,
    portalUrl: buildOrderPortalUrl(nerpPublicOrigin(), input.publicToken),
    whatsappUrl: buildOrderWhatsappUrl({
      whatsappNumber: input.whatsappNumber,
      saleNumber: input.saleNumber,
      publicToken: input.publicToken,
    }),
  };
}


async function resolveEntryStatusId(trackingId: string, statusId: string | null) {
  const status = statusId
    ? await prisma.status.findFirst({ where: { id: statusId, trackingId }, select: { id: true } })
    : null;
  if (status) return status.id;
  const firstStatus = await prisma.status.findFirst({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (!firstStatus) throw new Error("status_not_configured");
  return firstStatus.id;
}

// Cliente recorrente já tem lead no tracking (phone+tracking é único): o
// pedido novo o traz de volta pro topo da coluna de entrada e religa a IA.
async function findOrCreateOrderLead(input: {
  trackingId: string;
  statusId: string;
  phone: string;
  payload: NerpCatalogOrderPayload;
}): Promise<OrderLead> {
  const { payload } = input;
  // O mesmo celular pode estar gravado sem o 9º dígito (wa_id de conta antiga): sem isso o pedido
  // abria um segundo lead e a resposta do cliente no WhatsApp caía no outro.
  const existingLead = await prisma.lead.findFirst({
    where: { trackingId: input.trackingId, phone: { in: waIdLookupVariants(input.phone) } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, conversation: { select: { id: true } } },
  });

  if (!existingLead) {
    const created = await createInChatLead({
      trackingId: input.trackingId,
      statusId: input.statusId,
      phone: input.phone,
      name: payload.customer.name,
      appOrigin: nerpPublicOrigin(),
      source: LeadSource.NERP_CATALOG,
      sourceLabel: "Catálogo online NERP",
    });
    await prisma.lead.update({
      where: { id: created.lead.id },
      data: {
        amount: toLeadAmountCents(payload.total),
        ...(payload.customer.email ? { email: payload.customer.email } : {}),
        ...(payload.customer.document ? { document: payload.customer.document } : {}),
      },
    });
    return { ...created.lead, isNew: true, statusId: input.statusId };
  }

  const firstLead = await prisma.lead.findFirst({
    where: { statusId: input.statusId },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  const now = new Date();
  const lead = await prisma.lead.update({
    where: { id: existingLead.id },
    data: {
      statusId: input.statusId,
      order: firstLead ? Number(firstLead.order) - 1 : 0,
      statusEnteredAt: now,
      lastStatusChangeAt: now,
      statusFlow: "WAITING",
      isActive: true,
      // Pedido anterior pode ter fechado o lead como ganho: o pedido novo o reabre no funil.
      currentAction: "ACTIVE",
      closedAt: null,
      amount: toLeadAmountCents(payload.total),
      ...(payload.customer.email ? { email: payload.customer.email } : {}),
      ...(payload.customer.document ? { document: payload.customer.document } : {}),
      ...(existingLead.conversation
        ? {}
        : {
            conversation: {
              create: {
                remoteJid: `${input.phone}@s.whatsapp.net`,
                trackingId: input.trackingId,
                isActive: true,
              },
            },
          }),
    },
    select: {
      id: true,
      isActive: true,
      firstResponseAt: true,
      lastInboundAt: true,
      conversation: { select: { id: true } },
    },
  });
  if (!lead.conversation) throw new Error("conversation_creation_failed");
  // Pedido novo é passo da IA (Astro do catálogo), mesmo que um atendente tenha falado antes (spec 0113).
  await handOverToAi({ leadId: lead.id }).catch((error: unknown) =>
    console.warn("[nerp-catalog] estado de atendimento falhou", error),
  );
  return { ...lead, conversation: lead.conversation, isNew: false, statusId: input.statusId };
}

export async function receiveCatalogOrder(
  organizationId: string,
  payload: NerpCatalogOrderPayload,
): Promise<NerpCatalogOrderResponse> {
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId },
  });
  if (!integration?.isActive) throw new CatalogIntegrationInactiveError();

  const existingOrder = await prisma.catalogOrder.findUnique({
    where: { nerpSaleId: payload.nerpSaleId },
    select: { organizationId: true, publicToken: true, nerpSaleNumber: true },
  });
  if (existingOrder) {
    if (existingOrder.organizationId !== organizationId) {
      throw new Error("sale_belongs_to_another_org");
    }
    return buildResponse({
      publicToken: existingOrder.publicToken,
      saleNumber: existingOrder.nerpSaleNumber,
      whatsappNumber: integration.whatsappNumber,
    });
  }

  const tracking = await prisma.tracking.findFirst({
    where: { id: integration.ordersTrackingId, organizationId },
    select: { id: true, globalAiActive: true },
  });
  if (!tracking) throw new CatalogIntegrationInactiveError();

  const statusId = await resolveEntryStatusId(tracking.id, integration.ordersStatusId);
  const phone = toWhatsappPhone(payload.customer.phone);
  const lead = await findOrCreateOrderLead({
    trackingId: tracking.id,
    statusId,
    phone,
    payload,
  });

  const publicToken = randomBytes(18).toString("base64url");
  const order = await prisma.catalogOrder.create({
    data: {
      organizationId,
      leadId: lead.id,
      trackingId: tracking.id,
      nerpSaleId: payload.nerpSaleId,
      nerpSaleNumber: payload.saleNumber,
      publicToken,
      items: payload.items,
      customer: payload.customer,
      delivery: payload.delivery,
      subtotal: payload.subtotal,
      shipping: payload.shipping,
      discount: payload.discount,
      total: payload.total,
      catalogUrl: payload.catalogUrl,
    },
    select: { id: true },
  });

  // O pedido entra na conversa como mensagem DO cliente: é ele quem abriu a
  // negociação, e assim o Astro responde num turno inbound normal.
  const orderMessage = await prisma.message.create({
    data: {
      conversationId: lead.conversation.id,
      messageId: `${CATALOG_ORDER_MESSAGE_PREFIX}${payload.nerpSaleId}`,
      body: buildOrderSummaryText({
        saleNumber: payload.saleNumber,
        items: payload.items,
        subtotal: payload.subtotal,
        shipping: payload.shipping,
        discount: payload.discount,
        total: payload.total,
        delivery: payload.delivery,
      }),
      fromMe: false,
      status: MessageStatus.SEEN,
      senderName: payload.customer.name,
      metadata: { kind: "catalog_order", catalogOrderId: order.id },
    },
  });

  // Venda guiada (spec 0104): a chegada fala uma vez só, pelo fluxo "chegada do pedido"; o Astro entra na resposta.
  const isGuidedSale = await hasActiveSalesApprovers(organizationId);

  await firePostInboundAutomations({
    trackingId: tracking.id,
    organizationId,
    globalAiActive: tracking.globalAiActive && !isGuidedSale,
    lead,
    messageId: orderMessage.id,
    externalMessageId: orderMessage.messageId,
    fromMe: false,
    channel: "IN_CHAT",
    messagePayload: orderMessage,
  });

  // Na venda guiada o link segue no "pedido liberado"; aqui seria mais uma mensagem junto da pergunta do fluxo.
  if (!isGuidedSale) {
    // Link de acompanhamento pelo WhatsApp do tracking; best-effort, o pedido já está gravado.
    const firstName = payload.customer.name.trim().split(/\s+/)[0];
    // Spec 0104: no número oficial sai pelo template `pedido_recebido` (antes ficava só no acompanhamento).
    const receivedTemplates = resolveApprovalTemplates(
      (await prisma.nerpCatalogIntegration.findUnique({ where: { organizationId }, select: { approvalTemplates: true } }))?.approvalTemplates,
    );
    await sendCustomerMessage({
      conversationId: lead.conversation.id,
      senderName: "Astro",
      text: `Olá, ${firstName}! Recebemos seu pedido #${payload.saleNumber} 🛒\nAcompanhe, fale com a loja e faça o pagamento por aqui: ${buildOrderPortalUrl(nerpPublicOrigin(), publicToken)}`,
      template: { name: receivedTemplates.orderReceived, bodyParameters: [firstName, String(payload.saleNumber)], urlButton: { index: 0, suffix: publicToken } },
      isWhatsappForced: true,
      metadata: { kind: "catalog_order_link", catalogOrderId: order.id },
    }).catch((error) => console.error("[nerp-catalog] order_link_whatsapp_failed", error));
  }

  // Etapas padrão (spec 0044): tag "Novo Pedido" — lead novo e reaberto não passam pelo evento de mudança de coluna.
  await handleCatalogStageEntry({ leadId: lead.id, statusId }).catch((error) =>
    console.error("[nerp-catalog] stage_entry_failed", error),
  );

  // Venda guiada (spec 0104, D-6): nada vai ao cliente agora. O fluxo "chegada do pedido" começa quando ele
  // envia o pedido pelo WhatsApp (tryStartGuidedOrderFromInbound); até lá o lead fica marcado no painel.
  if (isGuidedSale) {
    await markOrderAwaitingCustomer({ organizationId, leadId: lead.id }).catch((error) =>
      console.error("[nerp-catalog] awaiting_tag_failed", error),
    );
  }

  if (lead.isNew) {
    await publishLeadCreated({
      leadId: lead.id,
      trackingId: tracking.id,
      statusId: lead.statusId,
    }).catch((error) => console.error("[nerp-catalog] publish_lead_created_failed", error));
  }

  return buildResponse({
    publicToken,
    saleNumber: payload.saleNumber,
    whatsappNumber: integration.whatsappNumber,
  });
}
