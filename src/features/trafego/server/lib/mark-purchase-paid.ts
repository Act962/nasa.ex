import "server-only";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { getPostHogClient } from "@/lib/posthog-server";
import type { TrafegoPendingPurchaseStatus } from "@/generated/prisma/enums";
import { createTrafegoOrderFromPurchaseInTx } from "./create-order-from-purchase";
import { runTrafegoOrderPostCreation } from "./create-order-and-side-effects";

const SIGNUP_TOKEN_TTL_DAYS = 7;

/**
 * Confirma o pagamento de uma compra trafeGO — o único caminho, seja do webhook
 * do Stripe ou do "Confirmar PIX" da equipe.
 *
 * Idempotência pelo claim atômico: `updateMany` com guarda de status. Quem
 * chega primeiro ganha; o segundo recebe `alreadyPaid` e não gera efeito
 * nenhum. É isso que segura o caso do cliente que pagou no cartão E no PIX.
 */
export interface MarkPurchasePaidInput {
  pendingId: string;
  paymentSource: "stripe" | "pix";
  /** Valor efetivamente recebido; null quando o provedor não informa. */
  amountTotalCents: number | null;
  /** Stripe preenche; PIX não. */
  stripe?: {
    paymentIntentId?: string | null;
    checkoutSessionId?: string | null;
  };
  /**
   * PIX: quem confirmou e o que anotou. `confirmedByUserId` é null quando quem
   * confirmou foi o webhook do Asaas — não há operador, mas `pixConfirmedAt`
   * precisa ser gravado do mesmo jeito: é ele que identifica a compra como paga
   * no PIX se um cartão cair depois.
   */
  pix?: { confirmedByUserId: string | null; note?: string | null };
  /**
   * Status a partir dos quais o claim vale. Stripe só aceita PENDING; o PIX
   * também aceita EXPIRED, porque quem paga atrasado ainda tem que ser
   * confirmável — o dinheiro caiu na conta de qualquer jeito.
   */
  claimFromStatuses: TrafegoPendingPurchaseStatus[];
}

export type MarkPurchasePaidResult =
  | { status: "not_found" }
  | {
      status: "already_paid";
      via: "stripe" | "pix" | "unknown";
      amountMismatch: boolean;
    }
  | {
      status: "paid";
      pendingId: string;
      flow: string;
      orderId: string | null;
      amountMismatch: boolean;
    };

export async function markTrafegoPurchasePaid(
  input: MarkPurchasePaidInput,
): Promise<MarkPurchasePaidResult> {
  const { pendingId, paymentSource, amountTotalCents } = input;

  const pending = await prisma.trafegoPendingPurchase.findUnique({
    where: { id: pendingId },
    select: {
      id: true,
      email: true,
      flow: true,
      userId: true,
      status: true,
      amountBrlCents: true,
      platform: true,
      objective: true,
      paymentMethod: true,
      pixConfirmedAt: true,
      briefing: true,
    },
  });
  if (!pending) {
    console.warn(
      `[trafego/paid] ${paymentSource}: pendência não encontrada: ${pendingId}`,
    );
    return { status: "not_found" };
  }

  // Divergência de valor: gravamos o recebido e SINALIZAMOS. Reescalar a verba
  // em silêncio seria pior — ela é dinheiro que vai ser investido no anúncio
  // (spec 0008 CA-14).
  const hasMismatch =
    amountTotalCents !== null && amountTotalCents !== pending.amountBrlCents;
  if (hasMismatch) {
    console.warn(
      `[trafego/paid] divergência em ${pendingId}: esperado=${pending.amountBrlCents} recebido=${amountTotalCents}`,
    );
  }

  const claim = await prisma.trafegoPendingPurchase.updateMany({
    where: { id: pendingId, status: { in: input.claimFromStatuses } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(hasMismatch ? { amountMismatch: true } : {}),
      ...(input.stripe?.paymentIntentId
        ? { stripePaymentIntentId: input.stripe.paymentIntentId }
        : {}),
      ...(input.stripe?.checkoutSessionId
        ? { stripeSessionId: input.stripe.checkoutSessionId }
        : {}),
      ...(input.pix
        ? {
            paymentMethod: "PIX" as const,
            pixConfirmedAt: new Date(),
            pixConfirmedByUserId: input.pix.confirmedByUserId,
            pixReceivedBrlCents: amountTotalCents,
            pixConfirmationNote: input.pix.note ?? null,
          }
        : {}),
    },
  });

  if (claim.count === 0) {
    const via = pending.pixConfirmedAt
      ? ("pix" as const)
      : pending.status === "PAID" || pending.status === "REDEEMED"
        ? ("stripe" as const)
        : ("unknown" as const);

    // Cartão caindo depois de um PIX já confirmado = cobrança em duplicidade.
    // Ninguém repara nisso sozinho; a equipe precisa ser avisada para estornar.
    if (paymentSource === "stripe" && via === "pix") {
      await notifyDuplicatePayment(pendingId, pending.email).catch((error) =>
        console.error("[trafego/paid] aviso de duplicidade falhou:", error),
      );
    }

    console.log(
      `[trafego/paid] ${paymentSource}: ${pendingId} já estava pago (${via}).`,
    );
    return { status: "already_paid", via, amountMismatch: hasMismatch };
  }

  let orderId: string | null = null;

  // Fluxo autenticado: a conta já existe, então o pedido nasce agora.
  if (pending.flow === "authenticated" && pending.userId) {
    const briefing = (pending.briefing ?? {}) as Record<string, unknown>;
    const requestedOrganizationId =
      typeof briefing._organizationId === "string"
        ? briefing._organizationId
        : null;
    const member = await prisma.member.findFirst({
      where: {
        userId: pending.userId,
        ...(requestedOrganizationId
          ? { organizationId: requestedOrganizationId }
          : {}),
      },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });

    if (member) {
      const order = await prisma.$transaction(async (tx) =>
        createTrafegoOrderFromPurchaseInTx({
          tx,
          pendingPurchaseId: pending.id,
          organizationId: member.organizationId,
          ownerUserId: pending.userId!,
        }),
      );
      await prisma.trafegoPendingPurchase.update({
        where: { id: pending.id },
        data: { status: "REDEEMED" },
      });
      await runTrafegoOrderPostCreation({
        orderId: order.id,
        buyer: { userId: pending.userId, email: pending.email },
      });
      orderId = order.id;
      capture(pending, amountTotalCents, hasMismatch, paymentSource);
      return {
        status: "paid",
        pendingId,
        flow: pending.flow,
        orderId,
        amountMismatch: hasMismatch,
      };
    }

    console.warn(
      `[trafego/paid] ${pendingId} flow=authenticated sem organização — caindo no fluxo de token.`,
    );
  }

  // Fluxo público: gera o token de ativação e dispara e-mail + WhatsApp.
  const signupToken = randomBytes(32).toString("hex");
  await prisma.trafegoPendingPurchase.update({
    where: { id: pending.id },
    data: {
      signupToken,
      tokenExpiresAt: new Date(
        Date.now() + SIGNUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      ),
    },
  });

  try {
    await inngest.send({ name: "trafego/purchase.paid", data: { pendingId } });
  } catch (error) {
    console.error(
      `[trafego/paid] ${paymentSource}: dispatch Inngest falhou:`,
      error,
    );
  }

  capture(pending, amountTotalCents, hasMismatch, paymentSource);
  console.log(`[trafego/paid] ✅ ${paymentSource} pago: ${pendingId}`);
  return {
    status: "paid",
    pendingId,
    flow: pending.flow,
    orderId,
    amountMismatch: hasMismatch,
  };
}

function capture(
  pending: {
    email: string;
    platform: string;
    objective: string;
    amountBrlCents: number;
  },
  amountTotalCents: number | null,
  hasMismatch: boolean,
  source: string,
) {
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: pending.email,
      event: "trafego_purchase_paid",
      properties: {
        platform: pending.platform,
        objective: pending.objective,
        amount_brl_cents: amountTotalCents ?? pending.amountBrlCents,
        amount_mismatch: hasMismatch,
        source,
      },
    });
    void posthog.shutdown();
  } catch (error) {
    console.error("[trafego/paid] posthog falhou:", error);
  }
}

async function notifyDuplicatePayment(
  pendingId: string,
  email: string,
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { isSystemAdmin: true, isActive: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.userNotification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "CUSTOM" as const,
      title: "trafeGO: cobrança em duplicidade",
      body: `O cartão de ${email} foi aprovado depois do PIX já confirmado. Verifique e estorne uma das cobranças.`,
      appKey: "trafego",
      actionUrl: "/admin/trafego",
    })),
  });
}
