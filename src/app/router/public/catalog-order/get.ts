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
import {
  buildOrderWhatsappUrl,
  toOrderCode,
} from "@/features/nerp-catalog/utils/format-order";

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

    const [logisticsStage, integration] = await Promise.all([
      resolveLogisticsStageName(order),
      prisma.nerpCatalogIntegration.findUnique({
        where: { organizationId: order.organizationId },
        select: { whatsappNumber: true, asaasApiKey: true },
      }),
    ]);
    const isAwaitingPayment = order.status === "AWAITING_PAYMENT";
    const leadStageKey = order.lead.status.systemKey;

    return {
      code: toOrderCode(order.publicToken),
      saleNumber: order.nerpSaleNumber,
      status: order.status,
      logisticsStage,
      // Etapa padrão do pedido (spec 0044); null = tracking sem as colunas padrão, linha do tempo antiga.
      stageKey: isCatalogStageKey(leadStageKey) ? leadStageKey : null,
      store: { name: order.organization.name, logo: order.organization.logo },
      customer: toPortalCustomer(order.customer),
      items: (order.items as CatalogOrderItem[]).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        imageUrl: item.imageUrl,
      })),
      delivery: order.delivery as CatalogOrderDelivery,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      discount: Number(order.discount),
      total: Number(order.total),
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
        canPayWithPix:
          (order.status === "RECEIVED" || order.status === "NEGOTIATING") && Boolean(integration?.asaasApiKey),
      },
      createdAt: order.createdAt,
    };
  });
