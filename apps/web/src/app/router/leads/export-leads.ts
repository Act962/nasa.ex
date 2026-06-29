import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const exportLeads = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Export leads with filters",
    tags: ["Leads"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      statusId: z.string().optional(),
      dateInit: z.string().optional(),
      dateEnd: z.string().optional(),
      actionFilter: z.enum(["ACTIVE", "WON", "LOST", "DELETED"]).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { trackingId, statusId, dateInit, dateEnd, actionFilter } = input;

    const leads = await prisma.lead.findMany({
      where: {
        trackingId,
        ...(statusId && { statusId }),
        ...(actionFilter && { currentAction: actionFilter }),
        ...(!actionFilter && { currentAction: "ACTIVE" }),
        ...(dateInit &&
          dateEnd && {
            createdAt: {
              gte: new Date(dateInit),
              lte: new Date(dateEnd),
            },
          }),
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        document: true,
        description: true,
        amount: true,
        temperature: true,
        source: true,
        profile: true,
        createdAt: true,
        status: {
          select: {
            name: true,
          },
        },
        responsible: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      leads: leads.map((lead) => ({
        ...lead,
        amount: lead.amount.toString(),
        statusName: lead.status.name,
        responsibleName: lead.responsible?.name || "Sem responsável",
      })),
    };
  });
