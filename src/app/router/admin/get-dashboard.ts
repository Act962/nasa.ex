import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getDashboard = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — Dashboard stats", tags: ["Admin"] })
  .output(z.object({
    totalOrgs: z.number(),
    totalUsers: z.number(),
    onlineNow: z.number(),
    totalStarsInCirculation: z.number(),
    planDistribution: z.array(z.object({ planName: z.string(), count: z.number() })),
    topOrgs: z.array(z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      starsBalance: z.number(),
      planName: z.string().nullable(),
      memberCount: z.number(),
      lastActivity: z.date().nullable(),
    })),
    recentTransactions: z.array(z.object({
      id: z.string(),
      orgName: z.string(),
      type: z.string(),
      amount: z.number(),
      description: z.string(),
      createdAt: z.date(),
    })),
  }))
  .handler(async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [
      totalOrgs,
      totalUsers,
      onlineNow,
      starsAgg,
      plans,
      orgsWithPlan,
      topOrgs,
      recentTransactions,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.userPresence.count({ where: { lastSeenAt: { gte: fiveMinutesAgo } } }),
      prisma.organization.aggregate({ _sum: { starsBalance: true } }),
      prisma.plan.findMany({ select: { id: true, name: true } }),
      prisma.organization.groupBy({ by: ["planId"], _count: { id: true } }),
      prisma.organization.findMany({
        orderBy: { starsBalance: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          starsBalance: true,
          plan: { select: { name: true } },
          _count: { select: { members: true } },
          activityLogs: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          },
        },
      }),
      prisma.starTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      }),
    ]);

    const planMap = new Map(plans.map((p) => [p.id, p.name]));
    const planDistribution = orgsWithPlan.map((g) => ({
      planName: g.planId ? (planMap.get(g.planId) ?? "Desconhecido") : "Sem plano",
      count: g._count.id,
    }));

    return {
      totalOrgs,
      totalUsers,
      onlineNow,
      totalStarsInCirculation: starsAgg._sum.starsBalance ?? 0,
      planDistribution,
      topOrgs: topOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        starsBalance: o.starsBalance,
        planName: o.plan?.name ?? null,
        memberCount: o._count.members,
        lastActivity: o.activityLogs[0]?.createdAt ?? null,
      })),
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        orgName: t.organization.name,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  });
