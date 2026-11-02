import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextTrafegoOrderCode } from "./order-code";
import { buildTrafegoPlanName } from "@/features/trafego/lib/order-values";
import { trafegoCreativeDraftSchema } from "@/features/trafego/lib/creative-review/schema";
import { resolveIncludedAds } from "@/features/trafego/lib/creative-limits";

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
      serviceFeePercent: true,
      serviceFeeBrlCents: true,
      setupFeeBrlCents: true,
      amountBrlCents: true,
      adBudgetPaidToMeta: true,
      hasBusinessManager: true,
      acceptedTermsAt: true,
      acceptedTermsVersion: true,
      stripeSessionId: true,
      stripePaymentIntentId: true,
      leadId: true,
      phoneVerifiedAt: true,
      socialHandle: true,
      socialProfile: true,
      hasOfficialNumber: true,
      officialNumber: true,
      officialNumberCheck: true,
      paymentMethod: true,
      complianceLevel: true,
      complianceIssues: true,
      desiredStartAt: true,
      earliestStartAt: true,
      startAcknowledgedAt: true,
      hasSocialLinked: true,
      materialsReady: true,
      desiredCreativeCount: true,
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
  const parsedCreativeDraft = trafegoCreativeDraftSchema.safeParse(briefing.creativeDraft);
  const creativeDraft = parsedCreativeDraft.success ? parsedCreativeDraft.data : null;

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

      planNameSnapshot:
        pending.plan?.name ?? buildTrafegoPlanName(pending.adBudgetBrlCents),
      campaignType: pending.campaignType,
      platform: pending.platform,
      objective: pending.objective,
      durationDays: pending.plan?.durationDays ?? 30,
      // Anúncios rodando ao mesmo tempo (spec 0127): faixa de verba + extras do checkout.
      maxCreatives: Math.max(pending.desiredCreativeCount ?? 0, resolveIncludedAds(pending.adBudgetBrlCents)),
      maxCopies: pending.plan?.maxCopies ?? 3,

      adBudgetBrlCents: pending.adBudgetBrlCents,
      serviceFeePercent: pending.serviceFeePercent,
      serviceFeeBrlCents: pending.serviceFeeBrlCents,
      setupFeeBrlCents: pending.setupFeeBrlCents,
      totalBrlCents: pending.amountBrlCents,
      adBudgetPaidToMeta: pending.adBudgetPaidToMeta,
      hasBusinessManager: pending.hasBusinessManager,
      acceptedTermsAt: pending.acceptedTermsAt,
      acceptedTermsVersion: pending.acceptedTermsVersion,
      stripeSessionId: pending.stripeSessionId,
      stripePaymentIntentId: pending.stripePaymentIntentId,

      businessName: asText(briefing.businessName) ?? pending.companyName,
      businessNiche: asText(briefing.businessNiche),
      targetAudience: asText(briefing.targetAudience),
      destinationUrl: asText(briefing.destinationUrl),
      whatsappNumber: asText(briefing.whatsappNumber) ?? pending.phone,
      notes: asText(briefing.notes),
      // Post escolhido no passo "Criativo" (spec 0126, RF-9).
      materialsProfileLink: creativeDraft?.postLink ?? null,

      // Já aponta pra org da agência: é lá que nascem os MetaAdsKpiSnapshot.
      metricsOrganizationId: settings?.agencyOrganizationId ?? null,

      // O card nasceu na compra ("Aguardando pagamento"); o pedido herda.
      leadId: pending.leadId,

      // Verificações feitas no wizard — a equipe confere na análise da conta.
      phoneVerifiedAt: pending.phoneVerifiedAt,
      socialHandle: pending.socialHandle,
      socialProfile: pending.socialProfile ?? undefined,
      hasOfficialNumber: pending.hasOfficialNumber,
      officialNumber: pending.officialNumber,
      officialNumberCheck: pending.officialNumberCheck ?? undefined,
      paymentMethod: pending.paymentMethod,
      complianceLevel: pending.complianceLevel,
      complianceIssues: pending.complianceIssues ?? undefined,
      desiredStartAt: pending.desiredStartAt,
      earliestStartAt: pending.earliestStartAt,
      startAcknowledgedAt: pending.startAcknowledgedAt,
      hasSocialLinked: pending.hasSocialLinked,
      materialsReady: pending.materialsReady,

      // Todo pedido passa pela análise da conta de anúncios antes dos materiais
      // (spec 0009 D-6). O cliente já pode subir criativos enquanto isso.
      status: "ACCOUNT_REVIEW",
      events: {
        create: [
          {
            toStatus: "PAID",
            title: "Pagamento confirmado",
            detail: "Recebemos seu pagamento e sua campanha foi criada.",
            source: "SYSTEM",
          },
          {
            fromStatus: "PAID",
            toStatus: "ACCOUNT_REVIEW",
            title: "Análise da conta de tráfego",
            detail:
              "Vamos verificar sua conta de anúncios (ou criar uma para você). Enquanto isso, envie seus criativos e a copy.",
            source: "SYSTEM",
          },
        ],
      },
    },
    select: { id: true, code: true, status: true },
  });

  if (creativeDraft?.fileKey) {
    await tx.trafegoCreative.create({
      data: {
        orderId: order.id,
        kind: creativeDraft.kind,
        fileKey: creativeDraft.fileKey,
        fileName: creativeDraft.fileName,
        fileSize: creativeDraft.fileSize,
        mimeType: creativeDraft.mimeType,
        width: creativeDraft.width,
        height: creativeDraft.height,
        durationSeconds: creativeDraft.durationSeconds,
        uploadedByUserId: ownerUserId,
        astroReview: creativeDraft.review ?? undefined,
      },
    });
  }

  const adMessage = creativeDraft?.message?.trim();
  if (adMessage) {
    await tx.trafegoCopy.create({
      data: {
        orderId: order.id,
        primaryText: adMessage,
        headline: creativeDraft?.headline?.trim() || null,
        callToAction: "Enviar mensagem",
        source: "CLIENT",
        isSelected: true,
      },
    });
  }

  return { ...order, alreadyExisted: false as const };
}
