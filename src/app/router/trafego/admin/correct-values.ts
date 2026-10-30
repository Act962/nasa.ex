import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  trafegoCampaignTypeSchema,
  trafegoObjectiveSchema,
} from "@/features/trafego/schema/trafego-schemas";
import { MAX_AD_BUDGET_BRL_CENTS } from "@/features/trafego/lib/pricing-tiers";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  CAMPAIGN_TYPES_BY_PLATFORM,
  OBJECTIVES_BY_PLATFORM,
} from "@/features/trafego/lib/catalog-labels";
import {
  buildTrafegoPlanName,
  deriveServiceFeePercent,
  isGeneratedTrafegoPlanName,
  planFinanceCorrection,
  planOrderValuesCorrection,
} from "@/features/trafego/lib/order-values";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";

const centsSchema = z.number().int().min(0).max(MAX_AD_BUDGET_BRL_CENTS);

/** Mudou no meio da transação: outra baixa no financeiro chegou antes. */
class FinanceChangedError extends Error {}

/** "Corrigir valores" de um pedido antes de ir ao ar (spec 0122, RF-16..RF-19). Só admin do sistema. */
export const correctTrafegoOrderValues = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      adBudgetBrlCents: centsSchema.min(100),
      serviceFeeBrlCents: centsSchema,
      setupFeeBrlCents: centsSchema,
      durationDays: z.number().int().min(1).max(365),
      campaignType: trafegoCampaignTypeSchema,
      objective: trafegoObjectiveSchema,
      reason: z.string().trim().min(3, "Diga o motivo da correção.").max(500),
    }),
  )
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        code: true,
        status: true,
        platform: true,
        pendingPurchaseId: true,
        planNameSnapshot: true,
        adBudgetBrlCents: true,
        serviceFeeBrlCents: true,
        setupFeeBrlCents: true,
        totalBrlCents: true,
        adBudgetPaidToMeta: true,
        durationDays: true,
        campaignType: true,
        objective: true,
      },
    });
    if (!order) throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });

    if (!OBJECTIVES_BY_PLATFORM[order.platform].includes(input.objective)) {
      throw new ORPCError("BAD_REQUEST", { message: "Objetivo não disponível para esse canal." });
    }
    if (!CAMPAIGN_TYPES_BY_PLATFORM[order.platform].includes(input.campaignType)) {
      throw new ORPCError("BAD_REQUEST", { message: "Tipo de campanha não disponível para esse canal." });
    }

    const correction = planOrderValuesCorrection({
      status: order.status,
      isLandingPurchase: Boolean(order.pendingPurchaseId),
      current: order,
      next: {
        adBudgetBrlCents: input.adBudgetBrlCents,
        serviceFeeBrlCents: input.serviceFeeBrlCents,
        setupFeeBrlCents: input.setupFeeBrlCents,
      },
    });
    if (!correction.ok) throw new ORPCError("CONFLICT", { message: correction.message });

    const settings = await loadTrafegoSettings();
    const nextRevenueBrlCents =
      input.serviceFeeBrlCents + input.setupFeeBrlCents + correction.extraCreativesBrlCents;
    const nextPlanName = isGeneratedTrafegoPlanName(order.planNameSnapshot)
      ? buildTrafegoPlanName(input.adBudgetBrlCents)
      : order.planNameSnapshot;
    const adminLabel = context.adminUser.name?.trim() || context.adminUser.email;
    const changeSummary = [
      `Verba ${formatBrlFromCents(order.adBudgetBrlCents)} → ${formatBrlFromCents(input.adBudgetBrlCents)}`,
      `taxa ${formatBrlFromCents(order.serviceFeeBrlCents)} → ${formatBrlFromCents(input.serviceFeeBrlCents)}`,
      `setup ${formatBrlFromCents(order.setupFeeBrlCents)} → ${formatBrlFromCents(input.setupFeeBrlCents)}`,
      `total ${formatBrlFromCents(order.totalBrlCents)} → ${formatBrlFromCents(correction.totalBrlCents)}`,
      `${order.durationDays} → ${input.durationDays} dias`,
    ].join(" · ");

    const loadFinanceEntries = (client: Prisma.TransactionClient) =>
      settings.agencyOrganizationId
        ? client.paymentEntry.findMany({
            where: { organizationId: settings.agencyOrganizationId, documentNumber: order.code },
            select: {
              id: true,
              type: true,
              status: true,
              amount: true,
              paidAmount: true,
              _count: { select: { bankTransactions: true } },
            },
          })
        : Promise.resolve([]);

    const toSnapshots = (entries: Awaited<ReturnType<typeof loadFinanceEntries>>) =>
      entries.map((entry) => ({
        id: entry.id,
        type: entry.type as "RECEIVABLE" | "PAYABLE",
        status: entry.status,
        amount: entry.amount,
        paidAmount: entry.paidAmount,
        reconciledTransactionsCount: entry._count.bankTransactions,
      }));

    const financePreview = planFinanceCorrection({
      entries: toSnapshots(await loadFinanceEntries(prisma)),
      nextAdBudgetBrlCents: input.adBudgetBrlCents,
      nextRevenueBrlCents,
    });
    if (!financePreview.ok) throw new ORPCError("CONFLICT", { message: financePreview.message });

    let financeNotes: string[] = [];
    try {
      financeNotes = await prisma.$transaction(async (tx) => {
        // Confere de novo dentro da transação: uma baixa concorrente muda a resposta (CB-10).
        const financePlan = planFinanceCorrection({
          entries: toSnapshots(await loadFinanceEntries(tx)),
          nextAdBudgetBrlCents: input.adBudgetBrlCents,
          nextRevenueBrlCents,
        });
        if (!financePlan.ok) throw new FinanceChangedError(financePlan.message);

        for (const update of financePlan.updates) {
          await tx.paymentEntry.update({
            where: { id: update.id },
            data: { amount: update.amount, paidAmount: update.paidAmount, status: update.status },
          });
        }

        await tx.trafegoOrder.update({
          where: { id: order.id },
          data: {
            adBudgetBrlCents: input.adBudgetBrlCents,
            serviceFeeBrlCents: input.serviceFeeBrlCents,
            serviceFeePercent: deriveServiceFeePercent(input.serviceFeeBrlCents, input.adBudgetBrlCents),
            setupFeeBrlCents: input.setupFeeBrlCents,
            totalBrlCents: correction.totalBrlCents,
            durationDays: input.durationDays,
            campaignType: input.campaignType,
            objective: input.objective,
            planNameSnapshot: nextPlanName,
            recommendations: Prisma.DbNull,
            recommendationsGeneratedAt: null,
          },
        });

        await tx.trafegoOrderEvent.createMany({
          data: [
            {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status,
              title: "Valores corrigidos pela equipe",
              detail: `${changeSummary}. Motivo: ${input.reason}. Por ${adminLabel}.`,
              isClientVisible: false,
              source: "ADMIN",
              actorUserId: context.adminUser.id,
            },
            {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status,
              title: "Valores do pedido atualizados pela equipe",
              detail: `Verba do anúncio: ${formatBrlFromCents(input.adBudgetBrlCents)} · ${input.durationDays} dias.`,
              isClientVisible: true,
              source: "ADMIN",
              actorUserId: context.adminUser.id,
            },
          ],
        });
        return financePlan.notes;
      });
    } catch (transactionError) {
      if (transactionError instanceof FinanceChangedError) {
        throw new ORPCError("CONFLICT", { message: transactionError.message });
      }
      throw transactionError;
    }

    return { orderId: order.id, totalBrlCents: correction.totalBrlCents, financeNotes };
  });
