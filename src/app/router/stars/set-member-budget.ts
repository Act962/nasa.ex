import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const setMemberBudget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      userId:        z.string(),
      monthlyBudget: z.number().min(0),
    })
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const orgId        = context.org.id;
    const requestorId  = context.user.id;

    // Only owner or moderador can set budgets
    const requestor = await prisma.member.findUnique({
      where:  { userId_organizationId: { userId: requestorId, organizationId: orgId } },
      select: { role: true },
    });

    if (!requestor || !["owner", "moderador", "admin"].includes(requestor.role)) {
      throw errors.FORBIDDEN({ message: "Apenas o dono ou moderador pode definir orçamentos." });
    }

    // Validate target is a member of this org
    const target = await prisma.member.findUnique({
      where: { userId_organizationId: { userId: input.userId, organizationId: orgId } },
    });

    if (!target) {
      throw errors.NOT_FOUND({ message: "Usuário não é membro desta organização." });
    }

    await prisma.memberStarBudget.upsert({
      where:  { organizationId_userId: { organizationId: orgId, userId: input.userId } },
      update: { monthlyBudget: input.monthlyBudget },
      create: {
        id:             `${orgId}-${input.userId}`,
        organizationId: orgId,
        userId:         input.userId,
        monthlyBudget:  input.monthlyBudget,
      },
    });

    return { success: true };
  });
