import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateOrgPlan = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Change org plan", tags: ["Admin"] })
  .input(z.object({
    orgId: z.string(),
    planId: z.string().nullable(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true, name: true, planId: true },
    });
    if (!org) throw errors.NOT_FOUND;

    if (input.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true } });
      if (!plan) throw errors.NOT_FOUND;
    }

    await prisma.organization.update({
      where: { id: input.orgId },
      data: { planId: input.planId },
    });

    return { success: true };
  });
