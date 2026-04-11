import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getPublicCalendar = base
  .input(z.object({ accessCode: z.string() }))
  .handler(async ({ input }) => {
    const access = await prisma.nasaCampaignPublicAccess.findUnique({
      where: { accessCode: input.accessCode },
      include: { campaignPlanner: { include: { events: { orderBy: { scheduledAt: "asc" } } } } },
    });

    if (!access || !access.isActive) throw new Error("Código de acesso inválido ou expirado.");
    if (access.expiresAt && access.expiresAt < new Date()) throw new Error("Link de acesso expirado.");

    await prisma.nasaCampaignPublicAccess.update({
      where: { id: access.id },
      data: { lastAccessedAt: new Date() },
    });

    const { campaignPlanner } = access;
    return {
      title: campaignPlanner.title,
      clientName: campaignPlanner.clientName,
      clientLogo: campaignPlanner.clientLogo,
      color: campaignPlanner.color,
      startDate: campaignPlanner.startDate,
      endDate: campaignPlanner.endDate,
      events: campaignPlanner.events,
      allowedViews: access.allowedViews,
    };
  });
