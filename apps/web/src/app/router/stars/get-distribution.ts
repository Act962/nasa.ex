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
        plan: { select: { monthlyStars: true } },
        members: {
          select: {
            userId: true,
            user:   { select: { name: true, email: true } },
          },
        },
        memberStarBudgets: {
          select: { userId: true, monthlyBudget: true, currentUsage: true },
        },
      },
    });

    const planMonthlyStars = org.plan?.monthlyStars ?? 0;
    const memberCount      = org.members.length;
    const equalShare       = memberCount > 0
      ? Math.floor(planMonthlyStars / memberCount)
      : 0;

    const budgetMap = new Map(
      org.memberStarBudgets.map((b) => [b.userId, b])
    );

    const members = org.members.map((m) => {
      const budget = budgetMap.get(m.userId);
      return {
        userId:        m.userId,
        userName:      m.user.name,
        userEmail:     m.user.email,
        monthlyBudget: budget?.monthlyBudget ?? 0,
        currentUsage:  budget?.currentUsage  ?? 0,
      };
    });

    return {
      mode:            org.starDistributionMode as "org" | "equal" | "custom",
      planMonthlyStars,
      memberCount,
      equalShare,
      members,
    };
  });
