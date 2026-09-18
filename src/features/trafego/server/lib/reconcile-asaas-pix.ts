import "server-only";
import prisma from "@/lib/prisma";
import {
  findPaymentsByExternalReference,
  getPayment,
  type AsaasPayment,
} from "@/lib/asaas";
import { loadTrafegoAsaasGateway } from "./asaas-gateway";
import { ASAAS_PAID_STATUSES } from "./asaas-events";
import { markTrafegoPurchasePaid } from "./mark-purchase-paid";

/**
 * Reconciliação: perguntar ao Asaas em vez de esperar o aviso dele.
 *
 * O webhook é um atalho para ser rápido, e atalhos falham em silêncio — evento
 * perdido, fila interrompida, Inngest fora do ar. Em todos esses casos o
 * cliente pagou, o dinheiro está na conta e o pedido continua parado. Aqui é
 * onde isso é descoberto.
 *
 * Idempotente por construção: quem confirma é o `markTrafegoPurchasePaid`, cujo
 * claim atômico já resolve a corrida com o webhook.
 */
export type ReconcileOutcome =
  | { status: "gateway_off" }
  | { status: "not_found"; pendingId: string }
  | { status: "already_settled"; pendingId: string }
  | { status: "no_charge"; pendingId: string }
  | { status: "still_open"; pendingId: string; chargeStatus: string }
  | {
      status: "confirmed";
      pendingId: string;
      receivedBrlCents: number;
      /** True = o webhook não deu conta e a reconciliação salvou o pagamento. */
      rescued: boolean;
    };

const OPEN_STATUSES = ["PENDING", "EXPIRED"] as const;

export async function reconcileTrafegoPixPending(
  pendingId: string,
): Promise<ReconcileOutcome> {
  const gateway = loadTrafegoAsaasGateway();
  if (!gateway) return { status: "gateway_off" };

  const pending = await prisma.trafegoPendingPurchase.findUnique({
    where: { id: pendingId },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      asaasPaymentId: true,
    },
  });
  if (!pending) return { status: "not_found", pendingId };

  if (!(OPEN_STATUSES as readonly string[]).includes(pending.status)) {
    return { status: "already_settled", pendingId };
  }

  let charge: AsaasPayment | null = null;

  if (pending.asaasPaymentId) {
    charge = await getPayment(
      gateway.secretKey,
      gateway.environment,
      pending.asaasPaymentId,
    );
  } else {
    // Vínculo não gravado: a cobrança existe no Asaas, mas o id nunca voltou
    // para cá. O `externalReference` é a segunda âncora.
    const found = await findPaymentsByExternalReference(
      gateway.secretKey,
      gateway.environment,
      pendingId,
    );
    charge = found.data.find((item) => !item.deleted) ?? found.data[0] ?? null;
    if (charge) {
      await prisma.trafegoPendingPurchase.update({
        where: { id: pendingId },
        data: { asaasPaymentId: charge.id },
      });
    }
  }

  if (!charge) return { status: "no_charge", pendingId };

  if (!(ASAAS_PAID_STATUSES as readonly string[]).includes(charge.status)) {
    return { status: "still_open", pendingId, chargeStatus: charge.status };
  }

  const receivedBrlCents = Math.round(charge.value * 100);
  const result = await markTrafegoPurchasePaid({
    pendingId,
    paymentSource: "pix",
    amountTotalCents: receivedBrlCents,
    pix: {
      confirmedByUserId: null,
      note: `Confirmado pela reconciliação com o Asaas (${charge.id}).`,
    },
    claimFromStatuses: ["PENDING", "EXPIRED"],
  });

  return {
    status: "confirmed",
    pendingId,
    receivedBrlCents,
    // Se o claim pegou aqui, ninguém tinha confirmado antes — ou seja, o
    // webhook não chegou. Isso é sinal de trilho quebrado, não rotina.
    rescued: result.status === "paid",
  };
}

export interface ReconcileSweepSummary {
  checked: number;
  confirmed: number;
  rescued: number;
  stillOpen: number;
  noCharge: number;
  failed: number;
}

/**
 * Varre as pendências PIX ainda abertas que já têm cobrança no Asaas.
 *
 * Roda dentro do cron horário que já existia — não criamos cron novo de
 * propósito: varredura por tempo custa igual com zero ou com mil vendas.
 */
export async function reconcileStuckTrafegoPix(params: {
  /** Ignora cobranças recém-criadas: o webhook merece a chance de chegar. */
  minAgeMinutes: number;
  /** Deixa de perseguir cobrança velha demais para ser paga. */
  maxAgeDays: number;
  limit: number;
}): Promise<ReconcileSweepSummary> {
  const now = Date.now();
  const candidates = await prisma.trafegoPendingPurchase.findMany({
    where: {
      paymentMethod: "PIX",
      status: { in: ["PENDING", "EXPIRED"] },
      asaasPaymentId: { not: null },
      createdAt: {
        lte: new Date(now - params.minAgeMinutes * 60_000),
        gte: new Date(now - params.maxAgeDays * 24 * 60 * 60_000),
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: params.limit,
  });

  const summary: ReconcileSweepSummary = {
    checked: candidates.length,
    confirmed: 0,
    rescued: 0,
    stillOpen: 0,
    noCharge: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      const outcome = await reconcileTrafegoPixPending(candidate.id);
      if (outcome.status === "confirmed") {
        summary.confirmed += 1;
        if (outcome.rescued) summary.rescued += 1;
      } else if (outcome.status === "still_open") {
        summary.stillOpen += 1;
      } else if (outcome.status === "no_charge") {
        summary.noCharge += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[trafego/reconcile] falha em ${candidate.id}:`,
        error,
      );
    }
  }

  return summary;
}

/**
 * Avisa os admins quando a reconciliação **salvou** um pagamento.
 *
 * Não é rotina: significa que o webhook não entregou. O pedido foi resolvido,
 * mas alguém precisa olhar a fila no painel do Asaas antes que o próximo
 * cliente pague e espere.
 */
export async function notifyPixRescue(
  summary: ReconcileSweepSummary,
): Promise<void> {
  if (summary.rescued === 0 && summary.failed === 0) return;

  const admins = await prisma.user.findMany({
    where: { isSystemAdmin: true, isActive: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const title =
    summary.rescued > 0
      ? "trafeGO: PIX confirmado pela reconciliação"
      : "trafeGO: reconciliação de PIX falhando";

  const body =
    summary.rescued > 0
      ? `${summary.rescued} pagamento(s) só foram confirmados pela varredura — o webhook do Asaas não entregou. Verifique se a fila está interrompida em Integrações → Webhooks.`
      : `A varredura não conseguiu consultar ${summary.failed} cobrança(s) no Asaas. Confira a chave de API e o status da conta.`;

  await prisma.userNotification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "CUSTOM" as const,
      title,
      body,
      appKey: "trafego",
      actionUrl: "/admin/trafego",
    })),
  });
}
