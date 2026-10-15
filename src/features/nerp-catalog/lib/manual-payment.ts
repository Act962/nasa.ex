// Loja sem Asaas: a equipe recebe o PIX por fora e confirma na aba Pedido. Segue o mesmo caminho do
// webhook do Asaas (`confirmCatalogOrderPayment`), então a venda guiada continua igual.
import "server-only";
import prisma from "@/lib/prisma";
import { confirmCatalogOrderPayment } from "./confirm-payment";

export class ManualPaymentError extends Error {}

const AWAITING_PAYMENT_STATUSES = ["NEGOTIATING", "AWAITING_PAYMENT"] as const;

/**
 * Pedido com cobrança no Asaas fica de fora: o Asaas confirma sozinho, e confirmar à mão deixaria aquele PIX
 * aberto para o cliente pagar de novo.
 */
export function canConfirmManualPayment(order: {
  status: string;
  quoteApprovedAt: Date | null;
  asaasPaymentId: string | null;
}): boolean {
  return (
    !!order.quoteApprovedAt &&
    !order.asaasPaymentId &&
    (AWAITING_PAYMENT_STATUSES as readonly string[]).includes(order.status)
  );
}

export async function confirmManualCatalogOrderPayment(params: {
  organizationId: string;
  orderId: string;
}): Promise<{ alreadyConfirmed: boolean }> {
  const order = await prisma.catalogOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    select: { id: true, status: true, quoteApprovedAt: true, total: true, asaasPaymentId: true },
  });
  if (!order) throw new ManualPaymentError("Pedido não encontrado.");
  if (!canConfirmManualPayment(order)) {
    throw new ManualPaymentError(
      "Este pedido não pode ser confirmado à mão: ainda sem valor aprovado, já pago ou com cobrança no Asaas.",
    );
  }

  const result = await confirmCatalogOrderPayment(order.id, {
    asaasPaymentId: `manual-${order.id}`,
    amount: order.total.toNumber(),
    billingType: "MANUAL",
    paidAt: new Date().toISOString(),
    source: "manual",
  });
  return { alreadyConfirmed: !!result.alreadyConfirmed };
}
