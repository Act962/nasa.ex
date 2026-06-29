import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requirePartnerMiddleware } from "@/app/middlewares/partner";
import prisma from "@/lib/prisma";

const partnerBase = base.use(requirePartnerMiddleware);

const ActivityZ = z.enum(["ACTIVE", "AT_RISK", "INACTIVE"]);

export const listReferrals = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Lista empresas indicadas",
    tags: ["Partner"],
  })
  .input(
    z.object({
      activityStatus: ActivityZ.optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
    }),
  )
  .output(
    z.object({
      referrals: z.array(
        z.object({
          id: z.string(),
          organizationId: z.string(),
          organizationName: z.string(),
          activityStatus: z.string(),
          source: z.string(),
          signedUpAt: z.string(),
          lastQualifyingActivityAt: z.string().nullable(),
          totalStarsConsumed: z.number(),
          totalPurchasedBrl: z.number(),
        }),
      ),
      total: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const where = {
      partnerUserId: context.partner.userId,
      ...(input.activityStatus
        ? { activityStatus: input.activityStatus }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.partnerReferral.findMany({
        where,
        orderBy: { signedUpAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          referredOrganization: { select: { id: true, name: true } },
        },
      }),
      prisma.partnerReferral.count({ where }),
    ]);

    return {
      referrals: rows.map((r) => ({
        id: r.id,
        organizationId: r.referredOrganization.id,
        organizationName: r.referredOrganization.name,
        activityStatus: r.activityStatus,
        source: r.source,
        signedUpAt: r.signedUpAt.toISOString(),
        lastQualifyingActivityAt:
          r.lastQualifyingActivityAt?.toISOString() ?? null,
        totalStarsConsumed: r.totalStarsConsumed,
        totalPurchasedBrl: Number(r.totalPurchasedBrl),
      })),
      total,
    };
  });

export const getActivityBreakdown = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Breakdown de atividade dos referrals",
    tags: ["Partner"],
  })
  .output(
    z.object({
      counts: z.object({
        active: z.number(),
        atRisk: z.number(),
        inactive: z.number(),
      }),
      atRiskList: z.array(
        z.object({
          id: z.string(),
          organizationName: z.string(),
          lastQualifyingActivityAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const partnerUserId = context.partner.userId;

    const [groups, atRisk] = await Promise.all([
      prisma.partnerReferral.groupBy({
        by: ["activityStatus"],
        where: { partnerUserId },
        _count: { _all: true },
      }),
      prisma.partnerReferral.findMany({
        where: { partnerUserId, activityStatus: "AT_RISK" },
        take: 20,
        orderBy: { lastQualifyingActivityAt: "asc" },
        include: { referredOrganization: { select: { name: true } } },
      }),
    ]);

    let active = 0,
      atRiskCount = 0,
      inactive = 0;
    for (const g of groups) {
      if (g.activityStatus === "ACTIVE") active = g._count._all;
      else if (g.activityStatus === "AT_RISK") atRiskCount = g._count._all;
      else if (g.activityStatus === "INACTIVE") inactive = g._count._all;
    }

    return {
      counts: { active, atRisk: atRiskCount, inactive },
      atRiskList: atRisk.map((r) => ({
        id: r.id,
        organizationName: r.referredOrganization.name,
        lastQualifyingActivityAt:
          r.lastQualifyingActivityAt?.toISOString() ?? null,
      })),
    };
  });

export const listVisits = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Histórico de visitas no link",
    tags: ["Partner"],
  })
  .input(
    z.object({
      limit: z.coerce.number().int().positive().max(200).default(50),
    }),
  )
  .output(
    z.object({
      visits: z.array(
        z.object({
          id: z.string(),
          ip: z.string().nullable(),
          userAgent: z.string().nullable(),
          visitedAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const link = await prisma.partnerReferralLink.findUnique({
      where: { userId: context.partner.userId },
    });
    if (!link) return { visits: [] };
    const rows = await prisma.partnerLinkVisit.findMany({
      where: { linkId: link.id },
      orderBy: { visitedAt: "desc" },
      take: input.limit,
    });
    return {
      visits: rows.map((v) => ({
        id: v.id,
        ip: v.ip,
        userAgent: v.userAgent,
        visitedAt: v.visitedAt.toISOString(),
      })),
    };
  });

export const getTierHistory = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Histórico de mudanças de nível",
    tags: ["Partner"],
  })
  .output(
    z.object({
      history: z.array(
        z.object({
          id: z.string(),
          fromTier: z.string().nullable(),
          toTier: z.string().nullable(),
          reason: z.string(),
          activeReferrals: z.number(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const rows = await prisma.partnerTierHistory.findMany({
      where: { partnerId: context.partner.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      history: rows.map((h) => ({
        id: h.id,
        fromTier: h.fromTier,
        toTier: h.toTier,
        reason: h.reason,
        activeReferrals: h.activeReferrals,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  });
