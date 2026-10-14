// Textos da venda guiada (spec 0104). Os parâmetros seguem a ordem das variáveis dos templates (seção 12 da spec).
import type { CatalogOrderItem } from "../../schemas/order-payload";
import { formatBrl } from "../../utils/format-order";
import { SALES_SECTOR_LABEL, type SalesSector } from "./approval-rules";

const DELIVERY_TIME_ZONE = "America/Sao_Paulo";

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: DELIVERY_TIME_ZONE });
const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: DELIVERY_TIME_ZONE });
const hourFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: DELIVERY_TIME_ZONE });

/** "quinta, 16/10 às 11h" (minutos só quando houver). */
export function formatDeliveryDate(date: Date | null): string {
  if (!date) return "a combinar";
  const weekday = weekdayFormatter.format(date).replace("-feira", "");
  const [hour, minute] = hourFormatter.format(date).split(":");
  const time = minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
  return `${weekday}, ${dayMonthFormatter.format(date)} às ${time}`;
}

export function firstNameOf(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first && first.toLowerCase() !== "sem" ? first : "tudo bem";
}

export function summarizeItems(items: CatalogOrderItem[], maxItems = 6): string {
  const parts = items.slice(0, maxItems).map((item) => `${item.quantity}x ${item.name}`);
  const rest = items.length - maxItems;
  return rest > 0 ? `${parts.join(", ")} e mais ${rest}` : parts.join(", ");
}

export type ApproverSummaryInput = {
  saleNumber: number;
  sector: SalesSector;
  customerName: string;
  items: CatalogOrderItem[];
  total: number;
  situation: string;
};

export function buildApproverSummary(input: ApproverSummaryInput) {
  const sectorLabel = SALES_SECTOR_LABEL[input.sector];
  const itemsText = summarizeItems(input.items);
  const totalText = formatBrl(input.total);
  const text = [
    `Pedido #${input.saleNumber} aguardando sua aprovação (${sectorLabel}).`,
    "",
    `- Cliente: ${input.customerName}`,
    "",
    `- Itens: ${itemsText}`,
    "",
    `- Total: ${totalText}`,
    "",
    `- Situação: ${input.situation}`,
    "",
    "Responda pelos botões abaixo.",
  ].join("\n");
  return {
    text,
    templateParameters: [String(input.saleNumber), sectorLabel, input.customerName, itemsText, totalText, input.situation],
  };
}

export function buildPostPaymentSummary(input: {
  saleNumber: number;
  sector: SalesSector;
  customerName: string;
  paidAmount: number;
  paymentMethodLabel: string;
  deliveryPromiseAt: Date | null;
}) {
  const sectorLabel = SALES_SECTOR_LABEL[input.sector];
  const amountText = formatBrl(input.paidAmount);
  const deliveryText = formatDeliveryDate(input.deliveryPromiseAt);
  const text = [
    `Pedido #${input.saleNumber} pago e aguardando sua conferência (${sectorLabel}).`,
    "",
    `- Cliente: ${input.customerName}`,
    "",
    `- Valor pago: ${amountText} via ${input.paymentMethodLabel}`,
    "",
    `- Entrega prevista: ${deliveryText}`,
    "",
    "Confirme pelos botões abaixo.",
  ].join("\n");
  return {
    text,
    templateParameters: [String(input.saleNumber), sectorLabel, input.customerName, amountText, input.paymentMethodLabel, deliveryText],
  };
}

export function buildPointsSentence(points: number | null): string | null {
  if (!points || points <= 0) return null;
  return `Essa compra soma ${points} ${points === 1 ? "ponto" : "pontos"} no seu cadastro pra trocar por brindes.`;
}

// Template não aceita variável vazia: sem programa de pontos vai uma frase neutra.
export const POINTS_TEMPLATE_FALLBACK = "Qualquer dúvida, é só chamar.";

export function buildCustomerQuoteMessage(input: {
  customerName: string;
  saleNumber: number;
  items: CatalogOrderItem[];
  shipping: number;
  discount: number;
  total: number;
  deliveryPromiseAt: Date | null;
  points: number | null;
  note?: string | null;
}) {
  const firstName = firstNameOf(input.customerName);
  const totalText = formatBrl(input.total);
  const deliveryText = formatDeliveryDate(input.deliveryPromiseAt);
  const pointsSentence = buildPointsSentence(input.points);
  const itemLines = input.items.map((item) => `• ${item.quantity}x ${item.name} — ${formatBrl(item.total)}`);
  const text = [
    `Oi, ${firstName}! O valor do seu pedido #${input.saleNumber} está pronto 😊`,
    "",
    ...itemLines,
    ...(input.shipping > 0 ? ["", `Frete: ${formatBrl(input.shipping)}`] : []),
    ...(input.discount > 0 ? [`Desconto: -${formatBrl(input.discount)}`] : []),
    "",
    `*Total: ${totalText}*`,
    `Entrega: ${deliveryText}`,
    ...(pointsSentence ? ["", pointsSentence] : []),
    ...(input.note?.trim() ? ["", input.note.trim()] : []),
    "",
    "Podemos fechar?",
  ].join("\n");
  return {
    text,
    templateParameters: [firstName, String(input.saleNumber), totalText, deliveryText, pointsSentence ?? POINTS_TEMPLATE_FALLBACK],
  };
}

export const CUSTOMER_QUOTE_BUTTONS = { close: "Fechar pedido", consultant: "Falar com consultor" } as const;
export const DELIVERY_CHANGE_BUTTONS = { accept: "Pode ser", consultant: "Falar com consultor" } as const;
