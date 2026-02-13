import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listLeadsByStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List leads by status with cursor pagination",
    tags: ["Leads"],
  })
  .input(
    z.object({
      statusId: z.string(),
      trackingId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      dateInit: z.string().optional(),
      dateEnd: z.string().optional(),
      participantFilter: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const {
      statusId,
      trackingId,
      cursor,
      limit,
      dateInit,
      dateEnd,
      participantFilter,
    } = input;

    const leads = await prisma.lead.findMany({
      where: {
        statusId,
        trackingId,
        // isActive: true,
        ...(dateInit &&
          dateEnd && {
            createdAt: {
              gte: new Date(dateInit),
              lte: new Date(dateEnd),
            },
          }),
        ...(participantFilter && {
          responsible: {
            email: participantFilter,
          },
        }),
      },
      orderBy: {
        order: "asc",
      },
      take: limit + 1,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
      skip: cursor ? 1 : 0,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        order: true,
        statusId: true,
        createdAt: true,
        profile: true,
        responsible: {
          select: {
            image: true,
            name: true,
          },
        },
      },
    });

    let nextCursor: string | undefined = undefined;

    if (leads.length > limit) {
      const nextItem = leads.pop();
      nextCursor = nextItem?.id;
    }

    return {
      leads: leads.map((lead) => ({
        ...lead,
        order: lead.order.toString(),
      })),
      nextCursor,
    };
  });
