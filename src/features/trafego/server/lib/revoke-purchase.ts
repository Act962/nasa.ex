import "server-only";
import prisma from "@/lib/prisma";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { transitionTrafegoOrder } from "./transition-order";
import { loadTrafegoSettings } from "./trafego-settings";
import { notifyTrafegoAdmins, recordTrafegoInternalEvent } from "./trafego-alerts";

/**
 * Reembolso TOTAL de uma compra (Stripe ou Asaas): compra REFUNDED, pedido
 * REFUNDED e financeiro revertido (P-5). Sem a reversão, a receita seguia
 * "paga" e o faturamento ficava inflado por uma venda devolvida.
 */
export async function revokeTrafegoPurchase(
  pendingId: string,
  gatewayLabel: string,
): Promise<void> {
  await prisma.trafegoPendingPurchase.update({
    where: { id: pendingId },
    data: { status: "REFUNDED" },
  });

  const order = await prisma.trafegoOrder.findUnique({
    where: { pendingPurchaseId: pendingId },
    select: { id: true, code: true },
  });
  if (!order) return;

  // Criativos e histórico ficam — o cliente pode contestar, e a equipe precisa
  // do rastro. O card vira perdido pela própria transição.
  await transitionTrafegoOrder({
    orderId: order.id,
    toStatus: "REFUNDED",
    source: "SYSTEM",
    title: "Pagamento reembolsado",
    clientNote: "O pagamento desta campanha foi reembolsado integralmente.",
  });

  await reverseTrafegoSaleEntries(order, gatewayLabel);
}

async function reverseTrafegoSaleEntries(
  order: { id: string; code: string },
  gatewayLabel: string,
): Promise<void> {
  const settings = await loadTrafegoSettings({ fresh: true });
  if (!settings.agencyOrganizationId) return;

  const reversalNote = `Estornado em ${new Date().toLocaleDateString("pt-BR")}: reembolso total (${gatewayLabel}).`;
  const entries = await prisma.paymentEntry.findMany({
    where: {
      organizationId: settings.agencyOrganizationId,
      documentNumber: order.code,
      type: { in: ["RECEIVABLE", "PAYABLE"] },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      type: true,
      status: true,
      notes: true,
      amount: true,
      paidAmount: true,
    },
  });

  // Verba já repassada à plataforma não volta sozinha: cancelar o lançamento
  // apagaria o rastro de um dinheiro que saiu. Fica para a equipe resolver.
  const alreadyPaidOut = entries.filter(
    (entry) =>
      entry.type === "PAYABLE" && (entry.status === "PAID" || entry.status === "PARTIAL"),
  );
  const toCancel = entries.filter((entry) => !alreadyPaidOut.includes(entry));

  for (const entry of toCancel) {
    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: {
        status: "CANCELLED",
        notes: [entry.notes, reversalNote].filter(Boolean).join("\n"),
      },
    });
  }

  // Repasse pago em parte: a parte paga fica registrada, o saldo deixa de ser
  // devido — a campanha foi reembolsada, não há mais verba a repassar.
  for (const entry of alreadyPaidOut) {
    if (entry.status !== "PARTIAL") continue;
    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: {
        status: "PAID",
        amount: entry.paidAmount,
        notes: [
          entry.notes,
          `${reversalNote} Saldo não repassado de ${formatBrlFromCents(entry.amount - entry.paidAmount)} baixado.`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  if (alreadyPaidOut.length > 0) {
    const paidOutBrlCents = alreadyPaidOut.reduce(
      (total, entry) => total + entry.paidAmount,
      0,
    );
    const detail = `Reembolso total com ${formatBrlFromCents(paidOutBrlCents)} de verba já repassada. O repasse não foi cancelado: confira com a plataforma de anúncios.`;
    await recordTrafegoInternalEvent({ orderId: order.id, title: "Estorno com verba já repassada", detail });
    await notifyTrafegoAdmins({
      title: `trafeGO ${order.code}: estorno com verba já repassada`,
      body: detail,
      actionUrl: `/admin/trafego/${order.id}`,
    });
  }
}

/**
 * Estorno parcial ou disputa: nada é revertido sozinho — quanto sai da taxa e
 * quanto sai da verba é decisão da equipe. Fica registrado no pedido e avisado.
 */
export async function flagTrafegoPaymentIssue(params: {
  pendingId: string;
  title: string;
  detail: string;
}): Promise<void> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { pendingPurchaseId: params.pendingId },
    select: { id: true, code: true },
  });

  if (order) {
    await recordTrafegoInternalEvent({
      orderId: order.id,
      title: params.title,
      detail: params.detail,
    });
  }
  await notifyTrafegoAdmins({
    title: `trafeGO${order ? ` ${order.code}` : ""}: ${params.title.toLowerCase()}`,
    body: params.detail,
    actionUrl: order ? `/admin/trafego/${order.id}` : "/admin/trafego",
  });
}
