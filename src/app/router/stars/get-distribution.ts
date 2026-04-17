import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getStarDistribution = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .output(
    z.object({
      mode: z.enum(["org", "equal", "custom"]),
      planMonthlyStars: z.number(),
      memberCount: z.number(),
      equalShare: z.number(),
      members: z.array(
        z.object({
          userId:        z.string(),
          userName:      z.string(),
          userEmail:     z.string(),
          monthlyBudget: z.number(),
          currentUsage:  z.number(),
        })
      ),
    })
  )
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const org = await prisma.organization.findUniqueOrThrow({
      where:  { id: orgId },
      select: {
        starDistributionMode: true,
        starsCycleStart: true,
        plan: { select: { monthlyStars: true } },
        members: {
          select: {
            userId: true,
            user:   { select: { name: true, email: true } },
          },
        },
        memberStarBudgets: {
          select: { userId: true, monthlyBudget: true },
        },
      },
    });

    const planMonthlyStars = org.plan?.monthlyStars ?? 0;
    const memberCount      = org.members.length;
    const equalShare       = memberCount > 0
      ? Math.floor(planMonthlyStars / memberCount)
      : 0;

    // Uso mensal calculado on-the-fly via StarTransaction — sem contador acumulado.
    // Início do ciclo = starsCycleStart da org ou dia 1 do mês atual (UTC).
    const cycleStart = org.starsCycleStart ?? (() => {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();

    const usageRows = await prisma.starTransaction.groupBy({
      by: ["userId"],
      where: {
        organizationId: orgId,
        userId: { not: null },
        amount: { lt: 0 },
        createdAt: { gte: cycleStart },
      },
      _sum: { amount: true },
    });

    const usageMap = new Map<string, number>();
    for (const row of usageRows) {
      if (row.userId) {
        usageMap.set(row.userId, Math.abs(row._sum.amount ?? 0));
      }
    }

    const budgetMap = new Map(
      org.memberStarBudgets.map((b) => [b.userId, b.monthlyBudget])
    );

    const members = org.members.map((m) => ({
      userId:        m.userId,
      userName:      m.user.name,
      userEmail:     m.user.email,
      monthlyBudget: budgetMap.get(m.userId) ?? 0,
      currentUsage:  usageMap.get(m.userId)  ?? 0,
    }));

    return {
      mode:            org.starDistributionMode as "org" | "equal" | "custom",
      planMonthlyStars,
      memberCount,
      equalShare,
      members,
    };
  });
