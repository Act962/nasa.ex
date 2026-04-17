import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { invalidateOrgRules } from "@/lib/rules-cache";
import { z } from "zod";
import { DEFAULT_RULES } from "./defaults";
import { ensureLevelsSeed, getBadgeUrlMap, resolveBadgeUrl } from "./utils";

const ruleOutput = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  points: z.number(),
  cooldownHours: z.number().nullable(),
  isActive: z.boolean(),
  popupTemplateId: z.string().nullable(),
  popupTemplateName: z.string().nullable(),
  category: z.string(),
});

export const adminGetSpaceOverview = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: global overview" })
  .output(
    z.object({
      totalUsers: z.number(),
      totalPointsAwarded: z.number(),
      activeOrgs: z.number(),
      topOrgs: z.array(
        z.object({
          orgId: z.string(),
          orgName: z.string(),
          totalPoints: z.number(),
          userCount: z.number(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const [totalUsers, totalPointsAgg, orgGroups] = await Promise.all([
      prisma.userSpacePoint.count(),
      prisma.userSpacePoint.aggregate({ _sum: { totalPoints: true } }),
      prisma.userSpacePoint.groupBy({
        by: ["orgId"],
        _sum: { totalPoints: true },
        _count: { userId: true },
        orderBy: { _sum: { totalPoints: "desc" } },
        take: 10,
      }),
    ]);
    const orgIds = orgGroups.map((o) => o.orgId);
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
    return {
      totalUsers,
      totalPointsAwarded: totalPointsAgg._sum.totalPoints ?? 0,
      activeOrgs: orgGroups.length,
      topOrgs: orgGroups.map((o) => ({
        orgId: o.orgId,
        orgName: orgMap[o.orgId] ?? "–",
        totalPoints: o._sum.totalPoints ?? 0,
        userCount: o._count.userId,
      })),
    };
  });

export const adminGetOrgUsers = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: users for org" })
  .input(
    z.object({
      orgId: z.string(),
      page: z.number().default(1),
      limit: z.number().default(30),
    }),
  )
  .output(
    z.object({
      users: z.array(
        z.object({
          userId: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
          totalPoints: z.number(),
          weeklyPoints: z.number(),
          levelName: z.string().nullable(),
        }),
      ),
      total: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    await ensureLevelsSeed();
    const allLevels = await prisma.spacePointLevel.findMany({
      orderBy: { order: "asc" },
    });
    const [pts, total] = await Promise.all([
      prisma.userSpacePoint.findMany({
        where: { user: { members: { some: { organizationId: input.orgId } } } },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { totalPoints: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.userSpacePoint.count({
        where: { user: { members: { some: { organizationId: input.orgId } } } },
      }),
    ]);
    return {
      users: pts.map((p) => {
        const earned = allLevels.filter(
          (l) => l.requiredPoints <= p.totalPoints,
        );
        const lvl = earned[earned.length - 1] ?? null;
        return {
          userId: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
          totalPoints: p.totalPoints,
          weeklyPoints: p.weeklyPoints,
          levelName: lvl?.name ?? null,
        };
      }),
      total,
    };
  });

export const adminAdjustUserPoints = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin: adjust user points" })
  .input(
    z.object({
      userId: z.string(),
      orgId: z.string(),
      points: z.number(),
      description: z.string().default("Ajuste manual pelo admin"),
    }),
  )
  .output(z.object({ success: z.boolean(), newTotal: z.number() }))
  .handler(async ({ input }) => {
    let userPoint = await prisma.userSpacePoint.findUnique({
      where: { userId: input.userId },
    });
    if (!userPoint)
      userPoint = await prisma.userSpacePoint.create({
        data: { userId: input.userId, orgId: input.orgId },
      });
    const newTotal = Math.max(0, userPoint.totalPoints + input.points);
    await prisma.$transaction([
      prisma.userSpacePoint.update({
        where: { id: userPoint.id },
        data: { totalPoints: newTotal },
      }),
      prisma.spacePointTransaction.create({
        data: {
          userPointId: userPoint.id,
          orgId: input.orgId,
          points: input.points,
          description: input.description,
          metadata: { source: "admin_adjustment" },
        },
      }),
    ]);
    return { success: true, newTotal };
  });

export const adminGetOrgRules = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: org rules" })
  .input(z.object({ orgId: z.string() }))
  .output(z.array(ruleOutput))
  .handler(async () => {
    const rules = await prisma.spacePointRule.findMany({
      orderBy: [{ points: "desc" }, { label: "asc" }],
    });
    const tplIds = [
      ...new Set(rules.map((r) => r.popupTemplateId).filter(Boolean)),
    ] as string[];
    const tplMap: Record<string, string> = {};
    if (tplIds.length) {
      const tpls = await prisma.achievementPopupTemplate.findMany({
        where: { id: { in: tplIds } },
        select: { id: true, name: true },
      });
      tpls.forEach((t) => {
        tplMap[t.id] = t.name;
      });
    }
    const defaultRuleMap = Object.fromEntries(
      DEFAULT_RULES.map((r) => [r.action, r.category]),
    );
    return rules.map((r) => ({
      id: r.id,
      action: r.action,
      label: r.label,
      points: r.points,
      cooldownHours: r.cooldownHours,
      isActive: r.isActive,
      popupTemplateId: r.popupTemplateId ?? null,
      popupTemplateName: r.popupTemplateId
        ? (tplMap[r.popupTemplateId] ?? null)
        : null,
      category: defaultRuleMap[r.action] ?? "custom",
    }));
  });

export const adminCreateOrgRule = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin: create global rule" })
  .input(
    z.object({
      action: z.string().min(1),
      label: z.string().min(1),
      points: z.number(),
      cooldownHours: z.number().nullable().optional(),
      popupTemplateId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input }) => {
    const created = await prisma.spacePointRule.create({
      data: {
        ...input,
        cooldownHours: input.cooldownHours ?? null,
        popupTemplateId: input.popupTemplateId ?? null,
      },
    });
    invalidateOrgRules("all"); // Might need a new clear-all function, but for now we follow pattern
    return { success: true, id: created.id };
  });

export const adminUpdateOrgRule = base
  .use(requireAdminMiddleware)
  .route({ method: "PATCH", summary: "Admin: update org rule" })
  .input(
    z.object({
      id: z.string(),
      points: z.number().optional(),
      cooldownHours: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      label: z.string().optional(),
      popupTemplateId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    const { id, ...data } = input;
    await prisma.spacePointRule.update({
      where: { id },
      data,
    });
    invalidateOrgRules("all");
    return { success: true };
  });

// Re-export getBadgeUrlMap for backward compat
export { getBadgeUrlMap, resolveBadgeUrl };
