import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextTrafegoOrderCode } from "./order-code";

interface CreateOrderInput {
  tx: Prisma.TransactionClient;
  pendingPurchaseId: string;
  organizationId: string;
  ownerUserId: string;
}

/**
 * Converte uma compra confirmada em pedido, dentro da transação do resgate.
 *
 * Idempotência: `TrafegoOrder.pendingPurchaseId` é `@unique`, então uma compra
 * gera no máximo um pedido. Se já existir, devolve o existente sem recriar —
 * cobre webhook tardio e retry do client.
 *
 * Todos os valores de catálogo e preço viram snapshot: mudar o plano depois
 * não reescreve o que foi vendido.
 */
export async function createTrafegoOrderFromPurchaseInTx({
  tx,
  pendingPurchaseId,
  organizationId,
  ownerUserId,
}: CreateOrderInput) {
  const existing = await tx.trafegoOrder.findUnique({
    where: { pendingPurchaseId },
    select: { id: true, code: true, status: true },
  });
  if (existing) return { ...existing, alreadyExisted: true as const };

  const pending = await tx.trafegoPendingPurchase.findUniqueOrThrow({
    where: { id: pendingPurchaseId },
    select: {
      id: true,
      planId: true,
      campaignType: true,
      platform: true,
      objective: true,
      briefing: true,
      companyName: true,
      phone: true,
      adBudgetBrlCents: true,
      serviceFeeBrlCents: true,
      amountBrlCents: true,
      stripeSessionId: true,
      stripePaymentIntentId: true,
      plan: {
        select: {
          name: true,
          durationDays: true,
          maxCreatives: true,
          maxCopies: true,
        },
      },
    },
  });

  const briefing = (pending.briefing ?? {}) as Record<string, unknown>;
  const asText = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const settings = await tx.trafegoSettings.findUnique({
    where: { id: "singleton" },
    select: { agencyOrganizationId: true },
  });

  const code = await nextTrafegoOrderCode(tx);

  const order = await tx.trafegoOrder.create({
    data: {
      code,
      organizationId,
      ownerUserId,
      planId: pending.planId,
      pendingPurchaseId: pending.id,

      planNameSnapshot: pending.plan?.name ?? "Plano trafeGO",
      campaignType: pending.campaignType,
      platform: pending.platform,
      objective: pending.objective,
      durationDays: pending.plan?.durationDays ?? 30,
      maxCreatives: pending.plan?.maxCreatives ?? 3,
      maxCopies: pending.plan?.maxCopies ?? 3,

      adBudgetBrlCents: pending.adBudgetBrlCents,
      serviceFeeBrlCents: pending.serviceFeeBrlCents,
      totalBrlCents: pending.amountBrlCents,
      stripeSessionId: pending.stripeSessionId,
      stripePaymentIntentId: pending.stripePaymentIntentId,

      businessName: asText(briefing.businessName) ?? pending.companyName,
      businessNiche: asText(briefing.businessNiche),
      targetAudience: asText(briefing.targetAudience),
      destinationUrl: asText(briefing.destinationUrl),
      whatsappNumber: asText(briefing.whatsappNumber) ?? pending.phone,
      notes: asText(briefing.notes),

      // Já aponta pra org da agência: é lá que nascem os MetaAdsKpiSnapshot.
      metricsOrganizationId: settings?.agencyOrganizationId ?? null,

      status: "ONBOARDING",
      events: {
        create: [
          {
            toStatus: "PAID",
            title: "Pagamento confirmado",
            detail: "Recebemos seu pagamento e sua campanha foi criada.",
          },
          {
            fromStatus: "PAID",
            toStatus: "ONBOARDING",
            title: "Envie seus materiais",
            detail:
              "Suba os criativos e escreva a copy para que nossa equipe possa colocar a campanha no ar.",
          },
        ],
      },
    },
    select: { id: true, code: true, status: true },
  });

  return { ...order, alreadyExisted: false as const };
}
