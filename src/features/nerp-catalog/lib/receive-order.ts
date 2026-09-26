import "server-only";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
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
  const existingLead = await prisma.lead.findUnique({
    where: { phone_trackingId: { phone: input.phone, trackingId: input.trackingId } },
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
        amount: payload.total,
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
      amount: payload.total,
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

  await firePostInboundAutomations({
    trackingId: tracking.id,
    organizationId,
    globalAiActive: tracking.globalAiActive,
    lead,
    messageId: orderMessage.id,
    externalMessageId: orderMessage.messageId,
    fromMe: false,
    channel: "IN_CHAT",
    messagePayload: orderMessage,
  });

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
