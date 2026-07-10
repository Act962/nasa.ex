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
    // Filtro de leads compartilhado entre a contagem (_count) e a soma de
    // valores (groupBy) — garante que os dois números respeitem exatamente os
    // mesmos filtros ativos do board.
    const leadWhere = {
      ...(actionFilter
        ? { currentAction: actionFilter }
        : { currentAction: "ACTIVE" as const }),
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
    };

    const [status, valueSums] = await Promise.all([
      prisma.status.findMany({
        where: {
          trackingId,
        },
        select: {
          id: true,
          name: true,
          color: true,
          order: true,
          slaHours: true,
          _count: {
            select: {
              leads: {
                where: leadWhere,
              },
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      }),
      prisma.lead.groupBy({
        by: ["statusId"],
        where: { status: { trackingId }, ...leadWhere },
        _sum: { amount: true },
      }),
    ]);

    const valueTotalByStatus = new Map(
      valueSums.map((row) => [row.statusId, row._sum.amount]),
    );

    return status.map((column) => ({
      ...column,
      valueTotal: (valueTotalByStatus.get(column.id) ?? 0).toString(),
    }));
  });
