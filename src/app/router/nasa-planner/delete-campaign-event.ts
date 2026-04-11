import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteCampaignEvent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ campaignId: z.string(), eventId: z.string() }))
  .handler(async ({ input, context }) => {
    const event = await prisma.nasaCampaignEvent.findFirst({
      where: { id: input.eventId, campaignPlannerId: input.campaignId, campaignPlanner: { organizationId: context.org.id } },
    });
    if (!event) throw new Error("Evento não encontrado.");
    await prisma.nasaCampaignEvent.delete({ where: { id: input.eventId } });
    return { success: true };
  });
