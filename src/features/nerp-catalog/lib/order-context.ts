import "server-only";
import prisma from "@/lib/prisma";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import type {
  CatalogOrderCustomer,
  CatalogOrderDelivery,
  CatalogOrderItem,
} from "../schemas/order-payload";
import { buildOrderPortalUrl, formatBrl } from "../utils/format-order";

export async function loadActiveCatalogOrder(leadId: string) {
  const order = await prisma.catalogOrder.findFirst({
    where: { leadId, status: { notIn: ["DELIVERED", "CANCELED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!order) return null;
  return {
    id: order.id,
    saleNumber: order.nerpSaleNumber,
    status: order.status,
    items: order.items as CatalogOrderItem[],
    customer: order.customer as CatalogOrderCustomer,
    delivery: order.delivery as CatalogOrderDelivery,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    discount: Number(order.discount),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    hasPendingCharge: !!order.asaasPaymentId && order.status === "AWAITING_PAYMENT",
    portalUrl: buildOrderPortalUrl(nerpPublicOrigin(), order.publicToken),
  };
}

export type ActiveCatalogOrder = NonNullable<Awaited<ReturnType<typeof loadActiveCatalogOrder>>>;

export function buildCatalogOrderPrompt(order: ActiveCatalogOrder): string {
  const itemLines = order.items
    .map((item) => `- ${item.quantity}x ${item.name} (${formatBrl(item.unitPrice)} un.) = ${formatBrl(item.total)}`)
    .join("\n");
  const hasDocument = !!order.customer.document;

  return `# Pedido do Catálogo online (#${order.saleNumber})

Este cliente fechou um carrinho no catálogo online da loja. Sua missão é conduzir o fechamento até o pagamento.

Status atual: ${order.status}
Itens:
${itemLines}
Subtotal: ${formatBrl(order.subtotal)} | Frete: ${formatBrl(order.shipping)} | Desconto: ${formatBrl(order.discount)} | Total: ${formatBrl(order.total)}
Entrega: ${order.delivery.method ?? "não informada"} | Endereço: ${order.delivery.address ?? "não informado"}
CPF/CNPJ do cliente: ${hasDocument ? "já informado" : "ainda NÃO informado"}
Link de acompanhamento do cliente: ${order.portalUrl}

## Critérios de fechamento (siga nesta ordem)
1. Confirme com o cliente os itens e quantidades do pedido.
2. Confirme a modalidade de entrega e o endereço completo (ou retirada). Registre com \`update_catalog_order_details\`.
3. Peça o CPF ou CNPJ (obrigatório para a cobrança) se ainda não tiver.
4. Pergunte a forma de pagamento: PIX (use \`create_pix_charge\`) ou cartão/boleto (use \`create_payment_link\`).
5. Só gere a cobrança depois dos itens 1 a 4 confirmados explicitamente pelo cliente. A ferramenta já envia o código/link ao cliente — não repita o código na sua mensagem.
6. Quando o cliente disser que pagou, use \`check_catalog_order_payment\`. Nunca afirme que o pagamento caiu sem essa confirmação.
7. Não altere preços nem conceda descontos: pedidos de mudança nos itens ou valores vão para um humano (\`transfer_to_human\`).`;
}
