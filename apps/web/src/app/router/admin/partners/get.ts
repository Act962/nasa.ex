import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";

const adminBase = base.use(requireAdminMiddleware);

export const getPartner = adminBase
  .route({
    method: "GET",
    summary: "Admin — Detalhe de parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      partner: z.object({
        id: z.string(),
        userId: z.string(),
        userName: z.string(),
        userEmail: z.string(),
        userImage: z.string().nullable(),
        status: z.string(),
        tier: z.string().nullable(),
        manualTierOverride: z.boolean(),
        activatedAt: z.string().nullable(),
        tierAchievedAt: z.string().nullable(),
        gracePeriodEndsAt: z.string().nullable(),
        gracePeriodFromTier: z.string().nullable(),
        gracePeriodToTier: z.string().nullable(),
        totalEarnedBrl: z.number(),
        totalPaidBrl: z.number(),
        totalSavingsBrl: z.number(),
        totalReferralRevenueBrl: z.number(),
        notes: z.string().nullable(),
        acceptedTermsVersionId: z.string().nullable(),
        acceptedTermsAt: z.string().nullable(),
        createdAt: z.string(),
      }),
      referralLink: z
        .object({
          code: z.string(),
          visits: z.number(),
          signups: z.number(),
        })
        .nullable(),
      counts: z.object({
        referralsActive: z.number(),
        referralsAtRisk: z.number(),
        referralsInactive: z.number(),
        commissionsPending: z.number(),
        commissionsReady: z.number(),
        payoutsPending: z.number(),
      }),
    }),
  )
  .handler(async ({ input, errors }) => {
    const partner = await prisma.partner.findUnique({
      where: { id: input.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            referralLink: true,
          },
        },
      },
    });
    if (!partner) throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });

    const [activeR, atRiskR, inactiveR, pendingC, readyC, scheduled] =
      await Promise.all([
        prisma.partnerReferral.count({
          where: {
            partnerUserId: partner.userId,
            activityStatus: "ACTIVE",
          },
        }),
        prisma.partnerReferral.count({
          where: {
            partnerUserId: partner.userId,
            activityStatus: "AT_RISK",
          },
        }),
        prisma.partnerReferral.count({
          where: {
            partnerUserId: partner.userId,
            activityStatus: "INACTIVE",
          },
        }),
        prisma.partnerCommission.count({
          where: { partnerId: partner.id, status: "PENDING" },
        }),
        prisma.partnerCommission.count({
          where: { partnerId: partner.id, status: "READY" },
        }),
        prisma.partnerPayout.count({
          where: {
            partnerId: partner.id,
            status: { in: ["SCHEDULED", "ADVANCED"] },
          },
        }),
      ]);

    return {
      partner: {
        id: partner.id,
        userId: partner.userId,
        userName: partner.user.name,
        userEmail: partner.user.email,
        userImage: partner.user.image ?? null,
        status: partner.status,
        tier: partner.tier,
        manualTierOverride: partner.manualTierOverride,
        activatedAt: partner.activatedAt?.toISOString() ?? null,
        tierAchievedAt: partner.tierAchievedAt?.toISOString() ?? null,
        gracePeriodEndsAt: partner.gracePeriodEndsAt?.toISOString() ?? null,
        gracePeriodFromTier: partner.gracePeriodFromTier,
        gracePeriodToTier: partner.gracePeriodToTier,
        totalEarnedBrl: Number(partner.totalEarnedBrl),
        totalPaidBrl: Number(partner.totalPaidBrl),
        totalSavingsBrl: Number(partner.totalSavingsBrl),
        totalReferralRevenueBrl: Number(partner.totalReferralRevenueBrl),
        notes: partner.notes,
        acceptedTermsVersionId: partner.acceptedTermsVersionId,
        acceptedTermsAt: partner.acceptedTermsAt?.toISOString() ?? null,
        createdAt: partner.createdAt.toISOString(),
      },
      referralLink: partner.user.referralLink
        ? {
            code: partner.user.referralLink.code,
            visits: partner.user.referralLink.visits,
            signups: partner.user.referralLink.signups,
          }
        : null,
      counts: {
        referralsActive: activeR,
        referralsAtRisk: atRiskR,
        referralsInactive: inactiveR,
        commissionsPending: pendingC,
        commissionsReady: readyC,
        payoutsPending: scheduled,
      },
    };
  });
