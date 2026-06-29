import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const setStarDistribution = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ mode: z.enum(["org", "equal", "custom"]) }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const orgId = context.org.id;
    const userId = context.user.id;

    // Only owner or moderador can change distribution
    const member = await prisma.member.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });

    if (!member || !["owner", "moderador", "admin"].includes(member.role)) {
      throw errors.FORBIDDEN({ message: "Apenas o dono ou moderador pode alterar a distribuição de Stars." });
    }

    await prisma.organization.update({
      where: { id: orgId },
      data:  { starDistributionMode: input.mode },
    });

    // If switching to "equal", auto-compute and upsert budgets for all members
    if (input.mode === "equal") {
      const org = await prisma.organization.findUniqueOrThrow({
        where:  { id: orgId },
        select: {
          plan:    { select: { monthlyStars: true } },
          members: { select: { userId: true } },
        },
      });

      const planMonthlyStars = org.plan?.monthlyStars ?? 0;
      const share = org.members.length > 0
        ? Math.floor(planMonthlyStars / org.members.length)
        : 0;

      await Promise.all(
        org.members.map((m) =>
          prisma.memberStarBudget.upsert({
            where:  { organizationId_userId: { organizationId: orgId, userId: m.userId } },
            update: { monthlyBudget: share },
            create: { id: `${orgId}-${m.userId}`, organizationId: orgId, userId: m.userId, monthlyBudget: share },
          })
        )
      );
    }

    return { success: true };
  });
