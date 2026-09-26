import type {
  CatalogOrderDelivery,
  CatalogOrderItem,
} from "../schemas/order-payload";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBrl(value: number): string {
  return currencyFormatter.format(value);
}

// Telefone do catálogo chega sem DDI na maioria das lojas; o WhatsApp exige.
export function toWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function toOrderCode(publicToken: string): string {
  return publicToken.slice(0, 6).toUpperCase();
}

export function buildOrderPortalUrl(appOrigin: string, publicToken: string): string {
  return `${appOrigin.replace(/\/$/, "")}/pedido/${publicToken}`;
}

export function buildOrderWhatsappUrl(input: {
  whatsappNumber: string | null;
  saleNumber: number;
  publicToken: string;
}): string | null {
  if (!input.whatsappNumber) return null;
  const phone = toWhatsappPhone(input.whatsappNumber);
  const text = `Olá! Quero finalizar meu pedido #${input.saleNumber} (código ${toOrderCode(input.publicToken)}).`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function buildOrderSummaryText(input: {
  saleNumber: number;
  items: CatalogOrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  delivery: CatalogOrderDelivery;
}): string {
  const itemLines = input.items.map(
    (item) => `• ${item.quantity}x ${item.name} — ${formatBrl(item.total)}`,
  );
  const totalLines = [
    `Subtotal: ${formatBrl(input.subtotal)}`,
    ...(input.shipping > 0 ? [`Frete: ${formatBrl(input.shipping)}`] : []),
    ...(input.discount > 0 ? [`Desconto: -${formatBrl(input.discount)}`] : []),
    `*Total: ${formatBrl(input.total)}*`,
  ];
  const deliveryLines = [
    ...(input.delivery.method ? [`Entrega: ${input.delivery.method}`] : []),
    ...(input.delivery.address ? [`Endereço: ${input.delivery.address}`] : []),
    ...(input.delivery.notes ? [`Obs.: ${input.delivery.notes}`] : []),
  ];

  return [
    `🛒 *Novo pedido #${input.saleNumber}* pelo catálogo online`,
    "",
    ...itemLines,
    "",
    ...totalLines,
    ...(deliveryLines.length > 0 ? ["", ...deliveryLines] : []),
  ].join("\n");
}
