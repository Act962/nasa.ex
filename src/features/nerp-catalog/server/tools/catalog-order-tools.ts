import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { ActiveCatalogOrder } from "../../lib/order-context";
import {
  CatalogOrderPaymentError,
  createOrderPaymentLink,
  createOrderPixCharge,
  refreshOrderPaymentStatus,
} from "../../lib/order-payments";
import { CatalogPaymentNotConfiguredError } from "../../lib/integration-config";
import { deliverTextToLead } from "../../lib/order-channel";
import { formatBrl } from "../../utils/format-order";
import { resolveQuoteState } from "../../lib/order-quote";
import { applyCatalogIntentTag, approveOrderQuote, CatalogQuoteError, requestOrderQuote } from "../../lib/order-quote-actions";

type CatalogOrderToolContext = {
  order: ActiveCatalogOrder;
  conversationId: string;
  assistantName: string;
};

function toToolError(error: unknown) {
  if (
    error instanceof CatalogOrderPaymentError ||
    error instanceof CatalogPaymentNotConfiguredError ||
    error instanceof CatalogQuoteError
  ) {
    return { ok: false, error: error.message };
  }
  console.error("[nerp-catalog/tools] falha", error);
  return { ok: false, error: "Falha ao falar com o gateway de pagamento. Transfira para um humano." };
}

const documentField = z
  .string()
  .optional()
  .describe("CPF (11 dígitos) ou CNPJ (14 dígitos) do cliente, se ele acabou de informar");

export function makeCatalogOrderTools(ctx: CatalogOrderToolContext): ToolSet {
  const tagWantsToPay = () =>
    applyCatalogIntentTag({ organizationId: ctx.order.organizationId, leadId: ctx.order.leadId, key: "wantsToPay" });

  return {
    get_catalog_order: tool({
      description: "Consulta o pedido do catálogo online deste cliente: itens, totais, entrega, status e a situação do valor (quoteState).",
      inputSchema: z.object({}),
      execute: async () => {
        const order = await prisma.catalogOrder.findUniqueOrThrow({
          where: { id: ctx.order.id },
          select: {
            status: true,
            items: true,
            delivery: true,
            total: true,
            paymentMethod: true,
            quoteRequestedAt: true,
            quotedAt: true,
            quoteApprovedAt: true,
          },
        });
        const total = Number(order.total);
        return {
          status: order.status,
          items: order.items,
          delivery: order.delivery,
          total,
          paymentMethod: order.paymentMethod,
          quoteState: resolveQuoteState({ ...order, total }),
        };
      },
    }),

    update_catalog_order_details: tool({
      description:
        "Registra no pedido os dados confirmados pelo cliente: endereço de entrega, observações e CPF/CNPJ.",
      inputSchema: z.object({
        address: z.string().optional().describe("Endereço completo de entrega confirmado"),
        deliveryMethod: z.string().optional().describe("Ex.: entrega, retirada na loja"),
        notes: z.string().optional(),
        document: documentField,
      }),
      execute: async ({ address, deliveryMethod, notes, document }) => {
        const nextDelivery = {
          ...ctx.order.delivery,
          ...(address ? { address } : {}),
          ...(deliveryMethod ? { method: deliveryMethod } : {}),
          ...(notes ? { notes } : {}),
        };
        const digits = document?.replace(/\D/g, "");
        const nextCustomer = {
          ...ctx.order.customer,
          ...(digits && (digits.length === 11 || digits.length === 14) ? { document: digits } : {}),
        };
        await prisma.catalogOrder.updateMany({
          where: { id: ctx.order.id, status: { in: ["RECEIVED", "NEGOTIATING"] } },
          data: { delivery: nextDelivery, customer: nextCustomer, status: "NEGOTIATING" },
        });
        ctx.order.delivery = nextDelivery;
        ctx.order.customer = nextCustomer;
        return { ok: true };
      },
    }),

    request_catalog_order_quote: tool({
      description:
        "Pede à equipe o valor do pedido (pedido sem preço, cliente pediu orçamento, desconto ou quer negociar). Avisa a equipe e marca o lead; você continua no atendimento. Depois diga ao cliente que o valor chega em instantes.",
      inputSchema: z.object({
        reason: z.string().max(200).describe("O que o cliente pediu — registro interno, não vai ao cliente"),
      }),
      execute: async () => {
        try {
          const result = await requestOrderQuote({ orderId: ctx.order.id, conversationId: ctx.conversationId });
          return { ok: true, teamNotified: true, ...result };
        } catch (error) {
          return toToolError(error);
        }
      },
    }),

    approve_catalog_order_quote: tool({
      description:
        "Registra que o cliente aprovou o valor enviado pela equipe. Só use quando ele confirmar explicitamente o valor. Depois pergunte a forma de pagamento.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const approval = await approveOrderQuote(ctx.order.id);
          ctx.order.quoteState = "approved";
          return { ok: true, approvedTotal: approval.total };
        } catch (error) {
          return toToolError(error);
        }
      },
    }),

    create_pix_charge: tool({
      description:
        "Gera a cobrança PIX do pedido na conta Asaas da loja e envia o código copia-e-cola ao cliente. Use só depois dos critérios de fechamento confirmados.",
      inputSchema: z.object({ document: documentField }),
      execute: async ({ document }) => {
        try {
          const pix = await createOrderPixCharge(ctx.order.id, document);
          await tagWantsToPay();
          await deliverTextToLead({
            conversationId: ctx.conversationId,
            senderName: ctx.assistantName,
            text: `PIX de ${formatBrl(pix.total)} gerado ✅\nCopie o código abaixo e cole no app do seu banco (PIX copia e cola). Você também vê o QR Code em ${ctx.order.portalUrl}`,
          });
          await deliverTextToLead({
            conversationId: ctx.conversationId,
            senderName: ctx.assistantName,
            text: pix.pixCopyPaste,
            metadata: { kind: "catalog_order_pix", catalogOrderId: ctx.order.id },
          });
          return { ok: true, sentToCustomer: true, total: pix.total, expiresAt: pix.expiresAt };
        } catch (error) {
          return toToolError(error);
        }
      },
    }),

    create_payment_link: tool({
      description:
        "Gera um link de pagamento Asaas (cartão de crédito ou boleto) e envia ao cliente. Use só depois dos critérios de fechamento confirmados.",
      inputSchema: z.object({ document: documentField }),
      execute: async ({ document }) => {
        try {
          const link = await createOrderPaymentLink(ctx.order.id, document);
          await tagWantsToPay();
          await deliverTextToLead({
            conversationId: ctx.conversationId,
            senderName: ctx.assistantName,
            text: `Seu link de pagamento de ${formatBrl(link.total)} (cartão ou boleto): ${link.invoiceUrl}`,
            metadata: { kind: "catalog_order_payment_link", catalogOrderId: ctx.order.id },
          });
          return { ok: true, sentToCustomer: true, total: link.total };
        } catch (error) {
          return toToolError(error);
        }
      },
    }),

    check_catalog_order_payment: tool({
      description:
        "Confere no Asaas se o pagamento do pedido foi recebido. Se sim, o pedido segue automaticamente para logística e o cliente é avisado.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await refreshOrderPaymentStatus(ctx.order.id);
          return { ok: true, isPaid: result.isPaid, gatewayStatus: result.asaasStatus };
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
  };
}
