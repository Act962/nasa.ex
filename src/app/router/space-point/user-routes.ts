import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { DEFAULT_RULES } from "./defaults";
import {
  ensureLevelsSeed,
  ensureGlobalSpacePointRules,
  ensureUserPoint,
  awardPoints,
  periodToDateRange,
  getBadgeUrlMap,
  resolveBadgeUrl,
} from "./utils";

export const getMySpacePoint = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get my space point data" })
  .output(
    z.object({
      totalPoints: z.number(),
      weeklyPoints: z.number(),
      currentLevel: z
        .object({
          order: z.number(),
          name: z.string(),
          requiredPoints: z.number(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        })
        .nullable(),
      nextLevel: z
        .object({
          order: z.number(),
          name: z.string(),
          requiredPoints: z.number(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        })
        .nullable(),
      progressPct: z.number(),
      seals: z.array(
        z.object({
          levelId: z.string(),
          name: z.string(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          earnedAt: z.string(),
          badgeUrl: z.string(),
        }),
      ),
      allLevels: z.array(
        z.object({
          id: z.string(),
          order: z.number(),
          name: z.string(),
          requiredPoints: z.number(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        }),
      ),
      recentTransactions: z.array(
        z.object({
          points: z.number(),
          description: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId)
      return {
        totalPoints: 0,
        weeklyPoints: 0,
        currentLevel: null,
        nextLevel: null,
        progressPct: 0,
        seals: [],
        allLevels: [],
        recentTransactions: [],
      };

    await ensureLevelsSeed();
    const [userPoint, allLevels, badgeMap] = await Promise.all([
      ensureUserPoint(user.id, orgId),
      prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } }),
      getBadgeUrlMap(),
    ]);
    const earnedSeals = await prisma.userSpacePointSeal.findMany({
      where: { userPointId: userPoint.id },
      include: { level: true },
      orderBy: { earnedAt: "asc" },
    });
    const recentTx = await prisma.spacePointTransaction.findMany({
      where: { userPointId: userPoint.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const tp = userPoint.totalPoints;
    const earned = allLevels.filter((l) => l.requiredPoints <= tp);
    const currentLevel = earned.length > 0 ? earned[earned.length - 1] : null;
    const nextLevel = allLevels.find((l) => l.requiredPoints > tp) ?? null;
    const progressPct = !nextLevel
      ? 100
      : Math.min(
          100,
          Math.round(
            ((tp - (currentLevel?.requiredPoints ?? 0)) /
              (nextLevel.requiredPoints -
                (currentLevel?.requiredPoints ?? 0))) *
              100,
          ),
        );

    return {
      totalPoints: tp,
      weeklyPoints: userPoint.weeklyPoints,
      currentLevel: currentLevel
        ? {
            order: currentLevel.order,
            name: currentLevel.name,
            requiredPoints: currentLevel.requiredPoints,
            badgeNumber: currentLevel.badgeNumber,
            planetEmoji: currentLevel.planetEmoji,
            badgeUrl: resolveBadgeUrl(currentLevel.badgeNumber, badgeMap),
          }
        : null,
      nextLevel: nextLevel
        ? {
            order: nextLevel.order,
            name: nextLevel.name,
            requiredPoints: nextLevel.requiredPoints,
            badgeNumber: nextLevel.badgeNumber,
            planetEmoji: nextLevel.planetEmoji,
            badgeUrl: resolveBadgeUrl(nextLevel.badgeNumber, badgeMap),
          }
        : null,
      progressPct,
      seals: earnedSeals.map((s) => ({
        levelId: s.levelId,
        name: s.level.name,
        badgeNumber: s.level.badgeNumber,
        planetEmoji: s.level.planetEmoji,
        earnedAt: s.earnedAt.toISOString(),
        badgeUrl: resolveBadgeUrl(s.level.badgeNumber, badgeMap),
      })),
      allLevels: allLevels.map((l) => ({
        id: l.id,
        order: l.order,
        name: l.name,
        requiredPoints: l.requiredPoints,
        badgeNumber: l.badgeNumber,
        planetEmoji: l.planetEmoji,
        badgeUrl: resolveBadgeUrl(l.badgeNumber, badgeMap),
      })),
      recentTransactions: recentTx.map((t) => ({
        points: t.points,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

export const earnSpacePoints = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Earn space points" })
  .input(
    z.object({
      action: z.string(),
      description: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .output(
    z.object({
      awarded: z.number(),
      totalPoints: z.number(),
      newSeals: z.array(
        z.object({
          name: z.string(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        }),
      ),
      popupTemplateId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId)
      return {
        awarded: 0,
        totalPoints: 0,
        newSeals: [],
        popupTemplateId: null,
      };
    const result = await awardPoints(
      user.id,
      orgId,
      input.action,
      input.description,
      input.metadata as object,
    );
    return {
      awarded: result.points,
      totalPoints: result.totalPoints,
      newSeals: result.newSeals,
      popupTemplateId: result.popupTemplateId,
    };
  });

export const getSpacePointRanking = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get ranking" })
  .input(
    z.object({
      period: z
        .enum(["weekly", "biweekly", "monthly", "annual", "alltime", "custom"])
        .default("weekly"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        userId: z.string(),
        name: z.string(),
        image: z.string().nullable(),
        points: z.number(),
        rank: z.number(),
        levelName: z.string().nullable(),
        badgeNumber: z.number().nullable(),
        badgeUrl: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return [];

    await ensureLevelsSeed();
    const [allLevels, badgeMap] = await Promise.all([
      prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } }),
      getBadgeUrlMap(),
    ]);

    if (input.period === "alltime") {
      const pts = await prisma.userSpacePoint.findMany({
        where: { user: { members: { some: { id: orgId } } } },

        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { totalPoints: "desc" },
        take: 50,
      });
      return pts.map((p, i) => {
        const e = allLevels.filter((l) => l.requiredPoints <= p.totalPoints);
        const lvl = e[e.length - 1] ?? null;
        return {
          userId: p.user.id,
          name: p.user.name,
          image: p.user.image,
          points: p.totalPoints,
          rank: i + 1,
          levelName: lvl?.name ?? null,
          badgeNumber: lvl?.badgeNumber ?? null,
          badgeUrl: lvl ? resolveBadgeUrl(lvl.badgeNumber, badgeMap) : null,
        };
      });
    }

    const { gte, lte } = periodToDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );
    const allUserPts = await prisma.userSpacePoint.findMany({
      where: { user: { members: { some: { id: orgId } } } },

      include: { user: { select: { id: true, name: true, image: true } } },
    });
    const userPtMap = Object.fromEntries(allUserPts.map((u) => [u.id, u]));
    const txAgg = await prisma.spacePointTransaction.groupBy({
      by: ["userPointId"],
      where: { orgId, createdAt: { gte, lte } },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 50,
    });

    return txAgg
      .map((row, i) => {
        const usp = userPtMap[row.userPointId];
        if (!usp) return null;
        const e = allLevels.filter((l) => l.requiredPoints <= usp.totalPoints);
        const lvl = e[e.length - 1] ?? null;
        return {
          userId: usp.user.id,
          name: usp.user.name,
          image: usp.user.image,
          points: row._sum.points ?? 0,
          rank: i + 1,
          levelName: lvl?.name ?? null,
          badgeNumber: lvl?.badgeNumber ?? null,
          badgeUrl: lvl ? resolveBadgeUrl(lvl.badgeNumber, badgeMap) : null,
        };
      })
      .filter(Boolean) as {
      userId: string;
      name: string;
      image: string | null;
      points: number;
      rank: number;
      levelName: string | null;
      badgeNumber: number | null;
      badgeUrl: string | null;
    }[];
  });

export const getUserStats = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get user stats" })
  .input(
    z.object({
      targetUserId: z.string(),
      period: z
        .enum(["weekly", "biweekly", "monthly", "annual", "alltime", "custom"])
        .default("alltime"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .output(
    z.object({
      totalInPeriod: z.number(),
      appBreakdown: z.array(
        z.object({
          action: z.string(),
          label: z.string(),
          points: z.number(),
          count: z.number(),
        }),
      ),
      history: z.array(
        z.object({
          points: z.number(),
          description: z.string(),
          action: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
      seals: z.array(
        z.object({
          name: z.string(),
          badgeNumber: z.number(),
          earnedAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId)
      return { totalInPeriod: 0, appBreakdown: [], history: [], seals: [] };

    const userPoint = await prisma.userSpacePoint.findUnique({
      where: { userId: input.targetUserId },
    });
    if (!userPoint)
      return { totalInPeriod: 0, appBreakdown: [], history: [], seals: [] };

    const { gte, lte } = periodToDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );
    const dateFilter = gte || lte ? { createdAt: { gte, lte } } : {};
    const transactions = await prisma.spacePointTransaction.findMany({
      where: { userPointId: userPoint.id, orgId, ...dateFilter },
      include: { rule: { select: { action: true, label: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const breakdown: Record<
      string,
      { action: string; label: string; points: number; count: number }
    > = {};
    let totalInPeriod = 0;
    for (const tx of transactions) {
      totalInPeriod += tx.points;
      const key = tx.rule?.action ?? "manual";
      const lbl = tx.rule?.label ?? tx.description;
      if (!breakdown[key])
        breakdown[key] = { action: key, label: lbl, points: 0, count: 0 };
      breakdown[key].points += tx.points;
      breakdown[key].count += 1;
    }

    const seals = await prisma.userSpacePointSeal.findMany({
      where: { userPointId: userPoint.id },
      include: { level: true },
      orderBy: { earnedAt: "desc" },
    });
    return {
      totalInPeriod,
      appBreakdown: Object.values(breakdown).sort(
        (a, b) => b.points - a.points,
      ),
      history: transactions.map((t) => ({
        points: t.points,
        description: t.description,
        action: t.rule?.action ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
      seals: seals.map((s) => ({
        name: s.level.name,
        badgeNumber: s.level.badgeNumber,
        earnedAt: s.earnedAt.toISOString(),
      })),
    };
  });

export const getSpacePointRules = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "List rules" })
  .output(
    z.array(
      z.object({
        id: z.string(),
        action: z.string(),
        label: z.string(),
        points: z.number(),
        cooldownHours: z.number().nullable(),
        isActive: z.boolean(),
        category: z.string(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return [];
    await ensureGlobalSpacePointRules();
    const rules = await prisma.spacePointRule.findMany({
      orderBy: [{ isActive: "desc" }, { label: "asc" }],
    });
    const categoryMap = Object.fromEntries(
      DEFAULT_RULES.map((r) => [r.action, r.category]),
    );
    return rules.map((r) => ({
      id: r.id,
      action: r.action,
      label: r.label,
      points: r.points,
      cooldownHours: r.cooldownHours,
      isActive: r.isActive,
      category: categoryMap[r.action] ?? "custom",
    }));
  });

export const updateSpacePointRule = base
  .use(requiredAuthMiddleware)
  .route({ method: "PATCH", summary: "Update rule" })
  .input(
    z.object({
      id: z.string(),
      points: z.number().optional(),
      cooldownHours: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      label: z.string().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const rule = await prisma.spacePointRule.findUnique({
      where: { id: input.id },
    });
    if (!rule) return { success: false };
    const { id, ...data } = input;
    await prisma.spacePointRule.update({ where: { id }, data });
    return { success: true };
  });

export const createSpacePointRule = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Create custom rule" })
  .input(
    z.object({
      action: z.string().min(1),
      label: z.string().min(1),
      points: z.number(),
      cooldownHours: z.number().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const created = await prisma.spacePointRule.create({
      data: {
        action: input.action,
        label: input.label,
        points: input.points,
        cooldownHours: input.cooldownHours ?? null,
      },
    });
    return { success: true, id: created.id };
  });

export const deleteSpacePointRule = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", summary: "Delete custom rule" })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const rule = await prisma.spacePointRule.findUnique({
      where: { id: input.id },
    });
    if (!rule) return { success: false };
    if (DEFAULT_RULES.some((r) => r.action === rule.action))
      return { success: false };
    await prisma.spacePointRule.delete({ where: { id: input.id } });
    return { success: true };
  });

export const getSpacePointPrizes = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get ranking prizes" })
  .input(z.object({ period: z.string().default("monthly") }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        rank: z.number(),
        period: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return [];
    const prizes = await prisma.spacePointRankingPrize.findMany({
      where: { orgId, period: input.period },
      orderBy: { rank: "asc" },
    });
    return prizes.map((p) => ({
      id: p.id,
      rank: p.rank,
      period: p.period,
      title: p.title,
      description: p.description,
      isActive: p.isActive,
    }));
  });

export const upsertSpacePointPrize = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Upsert prize" })
  .input(
    z.object({
      rank: z.number().min(1).max(20),
      period: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const result = await prisma.spacePointRankingPrize.upsert({
      where: {
        orgId_rank_period: { orgId, rank: input.rank, period: input.period },
      },
      create: {
        orgId,
        rank: input.rank,
        period: input.period,
        title: input.title,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
      update: {
        title: input.title,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true, id: result.id };
  });

export const deleteSpacePointPrize = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", summary: "Delete prize" })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const prize = await prisma.spacePointRankingPrize.findFirst({
      where: { id: input.id, orgId },
    });
    if (!prize) return { success: false };
    await prisma.spacePointRankingPrize.delete({ where: { id: input.id } });
    return { success: true };
  });
