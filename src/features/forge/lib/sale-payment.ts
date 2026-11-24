export type SalePaymentMethod = "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO" | "BOLETO";

export const PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  DEBITO: "Cartão de débito",
  CREDITO: "Cartão de crédito",
  BOLETO: "Boleto",
};

/** "Cartão de crédito em 10x sem juros", "PIX". */
export function describeSalePayment(method: SalePaymentMethod | null, installments: number | null): string | null {
  if (!method) return null;
  if (method === "CREDITO" && installments && installments > 1) return `${PAYMENT_METHOD_LABELS.CREDITO} em ${installments}x sem juros`;
  return PAYMENT_METHOD_LABELS[method];
}
