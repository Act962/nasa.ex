import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requirePartnerMiddleware } from "@/app/middlewares/partner";
import prisma from "@/lib/prisma";
import {
  currentCycleYearMonth,
  getCommissionRateForTier,
  getDiscountRateForTier,
  getProgramSettings,
  getThresholdForTier,
  nextPayoutDate,
  TIER_ORDER,
  tierLabel,
  tierRank,
} from "@/features/partner/lib/partner-service";

const partnerBase = base.use(requirePartnerMiddleware);

export const getDashboard = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Dashboard resumido",
    tags: ["Partner"],
  })
  .output(
    z.object({
      tier: z.string(),
      tierLabel: z.string(),
      activeReferrals: z.number(),
      atRiskReferrals: z.number(),
      inactiveReferrals: z.number(),
      totalReferrals: z.number(),
      visits30d: z.number(),
      signups30d: z.number(),
      currentCycleYearMonth: z.string(),
      pendingCommissionsBrl: z.number(),
      readyCommissionsBrl: z.number(),
      gracePeriod: z
        .object({
          endsAt: z.string(),
          fromTier: z.string().nullable(),
          toTier: z.string().nullable(),
        })
        .nullable(),
      nextTier: z
        .object({
          tier: z.string(),
          remaining: z.number(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const partner = context.partner;
    const settings = await getProgramSettings();

    const [counts, referralLink, pendingAgg, readyAgg] = await Promise.all([
      prisma.partnerReferral.groupBy({
        by: ["activityStatus"],
        where: { partnerUserId: partner.userId },
        _count: { _all: true },
      }),
      prisma.partnerReferralLink.findUnique({
        where: { userId: partner.userId },
      }),
      prisma.partnerCommission.aggregate({
        where: { partnerId: partner.id, status: "PENDING" },
        _sum: { commissionBrl: true },
      }),
      prisma.partnerCommission.aggregate({
        where: { partnerId: partner.id, status: "READY" },
        _sum: { commissionBrl: true },
      }),
    ]);

    let active = 0,
      atRisk = 0,
      inactive = 0;
    for (const c of counts) {
      if (c.activityStatus === "ACTIVE") active = c._count._all;
      else if (c.activityStatus === "AT_RISK") atRisk = c._count._all;
      else if (c.activityStatus === "INACTIVE") inactive = c._count._all;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [visits30d, signups30d] = await Promise.all([
      referralLink
        ? prisma.partnerLinkVisit.count({
            where: { linkId: referralLink.id, visitedAt: { gte: since } },
          })
        : Promise.resolve(0),
      prisma.partnerReferral.count({
        where: {
          partnerUserId: partner.userId,
          signedUpAt: { gte: since },
        },
      }),
    ]);

    const currentTier = partner.tier ?? "SUITE";
    const currentRank = tierRank(currentTier);
    const nextTierName =
      currentRank >= 0 && currentRank < TIER_ORDER.length - 1
        ? TIER_ORDER[currentRank + 1]
        : null;
    const nextTier = nextTierName
      ? {
          tier: nextTierName,
          remaining: Math.max(
            0,
            getThresholdForTier(nextTierName, settings) - active,
          ),
        }
      : null;

    return {
      tier: currentTier,
      tierLabel: tierLabel(currentTier),
      activeReferrals: active,
      atRiskReferrals: atRisk,
      inactiveReferrals: inactive,
      totalReferrals: active + atRisk + inactive,
      visits30d,
      signups30d,
      currentCycleYearMonth: currentCycleYearMonth(),
      pendingCommissionsBrl: Number(pendingAgg._sum.commissionBrl ?? 0),
      readyCommissionsBrl: Number(readyAgg._sum.commissionBrl ?? 0),
      gracePeriod: partner.gracePeriodEndsAt
        ? {
            endsAt: partner.gracePeriodEndsAt.toISOString(),
            fromTier: partner.gracePeriodFromTier,
            toTier: partner.gracePeriodToTier,
          }
        : null,
      nextTier,
    };
  });

export const getFinancialOverview = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Visão financeira completa do ciclo + vitalício",
    tags: ["Partner"],
  })
  .output(
    z.object({
      tier: z.string(),
      tierLabel: z.string(),
      activeReferrals: z.number(),
      currentCycle: z.object({
        yearMonth: z.string(),
        scheduledPayoutDate: z.string(),
        referralRevenueBrl: z.number(),
        commissionRatePercent: z.number(),
        grossCommissionBrl: z.number(),
        partnerPurchases: z.object({
          originalTotalBrl: z.number(),
          paidTotalBrl: z.number(),
          savingsBrl: z.number(),
          discountRatePercent: z.number(),
        }),
        netToReceiveBrl: z.number(),
        estimatedAdvanceFeeBrl: z.number(),
      }),
      lifetime: z.object({
        totalReferralRevenueBrl: z.number(),
        totalEarnedBrl: z.number(),
        totalPaidBrl: z.number(),
        pendingPayoutBrl: z.number(),
        totalSavingsBrl: z.number(),
      }),
    }),
  )
  .handler(async ({ context }) => {
    const partner = context.partner;
    const settings = await getProgramSettings();
    const tier = partner.tier ?? "SUITE";
    const cycle = currentCycleYearMonth();
    const commissionRate = getCommissionRateForTier(tier, settings);
    const discountRate = getDiscountRateForTier(tier, settings);

    const [activeReferrals, cycleComm, cyclePurchases, pendingPayoutAgg] =
      await Promise.all([
        prisma.partnerReferral.count({
          where: {
            partnerUserId: partner.userId,
            activityStatus: "ACTIVE",
          },
        }),
        prisma.partnerCommission.aggregate({
          where: {
            partnerId: partner.id,
            cycleYearMonth: cycle,
            status: { in: ["PENDING", "READY"] },
          },
          _sum: { basePaymentBrl: true, commissionBrl: true },
        }),
        prisma.partnerStarPurchase.aggregate({
          where: {
            partnerId: partner.id,
            createdAt: {
              gte: new Date(`${cycle}-01T00:00:00.000Z`),
            },
          },
          _sum: {
            originalPriceBrl: true,
            paidPriceBrl: true,
            savingsBrl: true,
          },
        }),
        prisma.partnerPayout.aggregate({
          where: {
            partnerId: partner.id,
            status: { in: ["SCHEDULED", "ADVANCED"] },
          },
          _sum: { netBrl: true },
        }),
      ]);

    const grossCommissionBrl = Number(cycleComm._sum.commissionBrl ?? 0);
    const advanceFee =
      Math.round(grossCommissionBrl * Number(settings.advanceFeePercent)) / 100;

    return {
      tier,
      tierLabel: tierLabel(tier),
      activeReferrals,
      currentCycle: {
        yearMonth: cycle,
        scheduledPayoutDate: nextPayoutDate(
          cycle,
          settings.payoutDayOfMonth,
        ).toISOString(),
        referralRevenueBrl: Number(cycleComm._sum.basePaymentBrl ?? 0),
        commissionRatePercent: commissionRate,
        grossCommissionBrl,
        partnerPurchases: {
          originalTotalBrl: Number(cyclePurchases._sum.originalPriceBrl ?? 0),
          paidTotalBrl: Number(cyclePurchases._sum.paidPriceBrl ?? 0),
          savingsBrl: Number(cyclePurchases._sum.savingsBrl ?? 0),
          discountRatePercent: discountRate,
        },
        netToReceiveBrl: grossCommissionBrl,
        estimatedAdvanceFeeBrl: advanceFee,
      },
      lifetime: {
        totalReferralRevenueBrl: Number(partner.totalReferralRevenueBrl),
        totalEarnedBrl: Number(partner.totalEarnedBrl),
        totalPaidBrl: Number(partner.totalPaidBrl),
        pendingPayoutBrl: Number(pendingPayoutAgg._sum.netBrl ?? 0),
        totalSavingsBrl: Number(partner.totalSavingsBrl),
      },
    };
  });
