import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getMany = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/list-status",
    summary: "List status only",
  })
  .input(
    z.object({
      trackingId: z.string(),
      dateInit: z.string().optional(),
      dateEnd: z.string().optional(),
      participantFilter: z.string().optional(),
      tagsFilter: z.array(z.string()).optional(),
      temperatureFilter: z.array(z.string()).optional(),
      actionFilter: z.enum(["ACTIVE", "WON", "LOST", "DELETED"]).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const {
      trackingId,
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
    } = input;
    const result = await prisma.status.findMany({
      where: {
        trackingId: input.trackingId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        order: true,
        _count: {
          select: {
            leads: {
              where: {
                ...(actionFilter
                  ? { currentAction: actionFilter }
                  : { currentAction: "ACTIVE" }),
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
                ...(tagsFilter &&
                  tagsFilter.length > 0 && {
                    leadTags: {
                      some: {
                        tag: {
                          slug: {
                            in: tagsFilter,
                          },
                        },
                      },
                    },
                  }),
                ...(temperatureFilter &&
                  temperatureFilter.length > 0 && {
                    temperature: {
                      in: temperatureFilter as any,
                    },
                  }),
              },
            },
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    const status = result.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      order: s.order.toString(),
      leads: s._count.leads,
    }));

    return status;
  });
