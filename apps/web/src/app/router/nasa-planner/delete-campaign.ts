import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteCampaign = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ campaignId: z.string() }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.nasaCampaignPlanner.findFirst({
      where: { id: input.campaignId, organizationId: context.org.id, deletedAt: null },
    });
    if (!existing) throw new Error("Planejamento não encontrado.");

    await prisma.nasaCampaignPlanner.update({
      where: { id: input.campaignId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  });
