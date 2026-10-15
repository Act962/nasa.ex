// Loja sem Asaas: a equipe recebe o PIX por fora e confirma na aba Pedido. Segue o mesmo caminho do
// webhook do Asaas (`confirmCatalogOrderPayment`), então a venda guiada continua igual.
import "server-only";
import prisma from "@/lib/prisma";
import { confirmCatalogOrderPayment } from "./confirm-payment";

export class ManualPaymentError extends Error {}

const AWAITING_PAYMENT_STATUSES = ["NEGOTIATING", "AWAITING_PAYMENT"] as const;

export function canConfirmManualPayment(order: { status: string; quoteApprovedAt: Date | null }): boolean {
  return !!order.quoteApprovedAt && (AWAITING_PAYMENT_STATUSES as readonly string[]).includes(order.status);
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
    throw new ManualPaymentError("O pedido ainda não tem valor aprovado pelo cliente, ou já foi pago.");
  }

  const result = await confirmCatalogOrderPayment(order.id, {
    // Cobrança do Asaas já criada: quita a mesma conta a receber. Sem ela, uma referência própria e única.
    asaasPaymentId: order.asaasPaymentId ?? `manual-${order.id}`,
    amount: order.total.toNumber(),
    billingType: "MANUAL",
    paidAt: new Date().toISOString(),
    source: "manual",
  });
  return { alreadyConfirmed: !!result.alreadyConfirmed };
}
