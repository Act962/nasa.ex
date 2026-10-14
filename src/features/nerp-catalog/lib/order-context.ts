import "server-only";
import prisma from "@/lib/prisma";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import type {
  CatalogOrderCustomer,
  CatalogOrderDelivery,
  CatalogOrderItem,
} from "../schemas/order-payload";
import { buildOrderPortalUrl, formatBrl } from "../utils/format-order";
import { resolveQuoteState, type QuoteState } from "./order-quote";
import { hasActiveSalesApprovers } from "./approvals/order-approvals";

export async function loadActiveCatalogOrder(leadId: string) {
  const order = await prisma.catalogOrder.findFirst({
    where: { leadId, status: { notIn: ["DELIVERED", "CANCELED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!order) return null;
  const isGuidedSale = await hasActiveSalesApprovers(order.organizationId);
  return {
    isGuidedSale,
    id: order.id,
    organizationId: order.organizationId,
    leadId: order.leadId,
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
    quoteState: resolveQuoteState({ ...order, total: Number(order.total) }),
    portalUrl: buildOrderPortalUrl(nerpPublicOrigin(), order.publicToken),
  };
}

export type ActiveCatalogOrder = NonNullable<Awaited<ReturnType<typeof loadActiveCatalogOrder>>>;

const QUOTE_STATE_PROMPT: Record<QuoteState, string> = {
  no_price: "Pedido SEM valor (produtos sem preço no catálogo). Peça o valor à equipe com `request_catalog_order_quote` assim que o cliente mostrar interesse em comprar.",
  awaiting_quote: "A equipe já foi avisada e vai enviar o valor. Não invente valor; diga que está chegando.",
  awaiting_internal_approval: "O consultor já mandou o valor e a equipe está aprovando. Não fale valor nenhum; diga que está quase pronto e que já já chega por aqui.",
  awaiting_approval: "A equipe enviou o valor acima e ele está AGUARDANDO a aprovação do cliente.",
  approved: "O cliente APROVOU o valor acima. Siga para a forma de pagamento.",
  priced: "Pedido com o valor do catálogo. Se o cliente quiser negociar, peça à equipe com `request_catalog_order_quote`.",
};

// Spec 0104: tom de conversa e divisão de tarefas com os fluxos da venda guiada (Gatilhos Automáticos).
const GUIDED_SALE_PROMPT = `## Venda guiada (fluxos dos Gatilhos cuidam das etapas) — estas regras valem acima dos critérios de fechamento
- Fale como gente: frases curtas, uma pergunta por vez, sem jargão. Pode usar "Oi", "Com certeza", "Valeu", "Sei como é", "Show", "Tranquilo" — nada agressivo nem forçado.
- Não encha o cliente de perguntas. NÃO pergunte se ele tem consultor nem peça CPF/CNPJ: os fluxos perguntam na hora certa.
- Quando o pedido chegar, confirme os itens com carinho e lembre que toda compra vale pontos pra trocar por brindes.
- Valor, prazo de entrega e pontos chegam por mensagem própria depois que a equipe aprova. Até lá diga que o valor está quase pronto.
- Se o cliente aprovar o valor ("sim", "fechado", "Fechar pedido"), use \`approve_catalog_order_quote\` e pergunte se prefere PIX ou cartão/boleto.
- Depois do pagamento, quem avisa a conferência e a entrega é o fluxo: não prometa prazo por conta própria.`;

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

## Situação do valor
${QUOTE_STATE_PROMPT[order.quoteState]}

## Critérios de fechamento (siga nesta ordem)
1. Confirme com o cliente os itens e quantidades do pedido.
2. Confirme a modalidade de entrega e o endereço completo (ou retirada). Registre com \`update_catalog_order_details\`.
3. Peça o CPF ou CNPJ (obrigatório para a cobrança) se ainda não tiver.
4. Valor: se o pedido está sem valor, ou o cliente pede preço, orçamento, desconto ou quer negociar, use \`request_catalog_order_quote\` e diga que a equipe já vai enviar o valor por aqui. Você continua acompanhando a conversa.
5. Quando o atendente enviar o valor, o cliente precisa aprovar. Aprovou ("sim", "pode fechar", "aprovado")? Use \`approve_catalog_order_quote\`. Quer mudar o valor? Use \`request_catalog_order_quote\` de novo.
6. Pergunte a forma de pagamento: PIX (use \`create_pix_charge\`) ou cartão/boleto (use \`create_payment_link\`).
7. Só gere a cobrança depois dos itens anteriores confirmados explicitamente pelo cliente. A ferramenta já envia o código/link ao cliente — não repita o código na sua mensagem. Se ela recusar, explique o motivo ao cliente com suas palavras.
8. Quando o cliente disser que pagou, use \`check_catalog_order_payment\`. Nunca afirme que o pagamento caiu sem essa confirmação. Depois do pagamento o cliente recebe os avisos de separação e entrega automaticamente.
9. Você nunca define, altera nem promete preço ou desconto: quem define o valor é sempre a equipe. Pedidos de mudar itens ou quantidades vão para um humano (\`transfer_to_human\`).${order.isGuidedSale ? `\n\n${GUIDED_SALE_PROMPT}` : ""}`;
}
