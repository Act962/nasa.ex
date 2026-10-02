// Pedido de "Comprar número" do assistente: o cliente fala com o comercial pelo WhatsApp
// e a equipe recebe uma cópia avisando do novo lead.

const DEFAULT_SALES_PHONE = "5511952133700";

/** Comercial que atende quem quer comprar o número (o cliente manda a mensagem pelo próprio WhatsApp). */
export const NUMBER_PURCHASE_SALES_PHONE =
  process.env.NEXT_PUBLIC_NUMBER_PURCHASE_SALES_PHONE?.replace(/\D/g, "") || DEFAULT_SALES_PHONE;

export const NUMBER_PURCHASE_CUSTOMER_MESSAGE = "Olá, quero comprar meu número da Api oficial do WhatsApp, como faço?";

export function buildNumberPurchaseWhatsAppUrl(): string {
  return `https://wa.me/${NUMBER_PURCHASE_SALES_PHONE}?text=${encodeURIComponent(NUMBER_PURCHASE_CUSTOMER_MESSAGE)}`;
}
