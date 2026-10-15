import { z } from "zod";
import { base } from "@/app/middlewares/base";
import {
  findOrderByPublicToken,
  resolveLogisticsStageName,
} from "@/features/nerp-catalog/lib/portal-order";
import type {
  CatalogOrderDelivery,
  CatalogOrderItem,
} from "@/features/nerp-catalog/schemas/order-payload";
import prisma from "@/lib/prisma";
import { isCatalogStageKey } from "@/features/nerp-catalog/lib/catalog-stages";
import { getChargeBlockReason, resolveQuoteState } from "@/features/nerp-catalog/lib/order-quote";
import { guidedTimelineHint, resolveGuidedTimelineStep } from "@/features/nerp-catalog/lib/guided-timeline";
import { hasActiveSalesApprovers } from "@/features/nerp-catalog/lib/approvals/order-approvals";
import { formatDeliveryDate } from "@/features/nerp-catalog/lib/approvals/approval-messages";
import {
  buildOrderWhatsappUrl,
  toOrderCode,
} from "@/features/nerp-catalog/utils/format-order";

const VALUE_HIDDEN_STATES = new Set(["no_price", "awaiting_quote", "awaiting_internal_approval"]);

// Público: o token (144 bits aleatórios) é a autorização do cliente.
// Link do portal pode ser repassado: telefone sai mascarado, só com os 4 últimos dígitos.
function toPortalCustomer(customer: unknown) {
  const raw = (customer ?? {}) as { name?: string; phone?: string };
  const digits = (raw.phone ?? "").replace(/\D/g, "");
  return {
    name: raw.name ?? "Cliente",
    phoneMasked: digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null,
  };
}

export const getPublicCatalogOrder = base
  .input(z.object({ token: z.string().min(16) }))
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    if (!order) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });

    const [logisticsStage, integration, isGuidedSale] = await Promise.all([
      resolveLogisticsStageName(order),
      prisma.nerpCatalogIntegration.findUnique({
        where: { organizationId: order.organizationId },
        select: { whatsappNumber: true, asaasApiKey: true },
      }),
      hasActiveSalesApprovers(order.organizationId).catch(() => false),
    ]);
    const isAwaitingPayment = order.status === "AWAITING_PAYMENT";
    const leadStageKey = order.lead.status.systemKey;
    const stageKey = isCatalogStageKey(leadStageKey) ? leadStageKey : null;
    const quoteState = resolveQuoteState({ ...order, total: Number(order.total) });
    // Valor digitado pelo consultor só aparece depois de aprovado pela equipe (spec 0104, Segurança de dados).
    const isValueHidden = VALUE_HIDDEN_STATES.has(quoteState);
    const toVisibleMoney = (value: number) => (isValueHidden ? 0 : value);
    // Venda guiada: a linha do tempo segue o WhatsApp (spec 0104, RF-22), não a coluna do lead.
    const guidedStep = isGuidedSale
      ? resolveGuidedTimelineStep({
          status: order.status,
          quoteState,
          stageKey,
          isPostPaymentApproved: Boolean(order.postPaymentApprovedAt),
        })
      : null;

    return {
      code: toOrderCode(order.publicToken),
      saleNumber: order.nerpSaleNumber,
      status: order.status,
      logisticsStage,
      // Etapa padrão do pedido (spec 0044); null = tracking sem as colunas padrão, linha do tempo antiga.
      stageKey,
      guidedTimeline:
        guidedStep === null
          ? null
          : {
              step: guidedStep,
              hint: guidedTimelineHint(
                guidedStep,
                order.deliveryPromiseAt ? formatDeliveryDate(order.deliveryPromiseAt) : null,
              ),
            },
      store: { name: order.organization.name, logo: order.organization.logo },
      customer: toPortalCustomer(order.customer),
      items: (order.items as CatalogOrderItem[]).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: toVisibleMoney(item.unitPrice),
        total: toVisibleMoney(item.total),
        imageUrl: item.imageUrl,
      })),
      delivery: order.delivery as CatalogOrderDelivery,
      subtotal: toVisibleMoney(Number(order.subtotal)),
      shipping: toVisibleMoney(Number(order.shipping)),
      discount: toVisibleMoney(Number(order.discount)),
      total: toVisibleMoney(Number(order.total)),
      catalogUrl: order.catalogUrl,
      whatsappUrl: buildOrderWhatsappUrl({
        whatsappNumber: integration?.whatsappNumber ?? null,
        saleNumber: order.nerpSaleNumber,
        publicToken: order.publicToken,
      }),
      payment: {
        method: order.paymentMethod,
        pixPayload: isAwaitingPayment ? order.pixPayload : null,
        pixQrImage: isAwaitingPayment ? order.pixQrImage : null,
        pixExpiresAt: isAwaitingPayment ? order.pixExpiresAt : null,
        invoiceUrl: isAwaitingPayment ? order.invoiceUrl : null,
        paidAt: order.paidAt,
        // Valor ainda em negociação (spec 0103): o portal não oferece PIX.
        canPayWithPix:
          (order.status === "RECEIVED" || order.status === "NEGOTIATING") &&
          Boolean(integration?.asaasApiKey) &&
          getChargeBlockReason({ ...order, total: Number(order.total) }) === null,
      },
      quoteState,
      createdAt: order.createdAt,
    };
  });
