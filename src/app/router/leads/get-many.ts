import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const sortOptions = z.enum(["order", "createdAt", "updatedAt"]);
type SortOption = z.infer<typeof sortOptions>;

function buildOrderBy(sortBy: SortOption) {
  const map: Record<SortOption, object[]> = {
    order: [{ order: "asc" }, { id: "asc" }],
    createdAt: [{ createdAt: "desc" }, { id: "asc" }],
    updatedAt: [{ updatedAt: "desc" }, { id: "asc" }],
  };
  return map[sortBy];
}

function buildCursorWhere(
  sortBy: SortOption,
  cursorId?: string,
  cursorValue?: string,
) {
  if (!cursorId || !cursorValue) return {};

  if (sortBy === "createdAt") {
    return {
      OR: [
        { createdAt: { lt: new Date(cursorValue) } },
        { createdAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  if (sortBy === "updatedAt") {
    return {
      OR: [
        { updatedAt: { lt: new Date(cursorValue) } },
        { updatedAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  // order (Decimal asc)
  return {
    OR: [
      { order: { gt: Number(cursorValue) } },
      { order: Number(cursorValue), id: { gt: cursorId } },
    ],
  };
}

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
      sortBy: sortOptions.default("order"),
      cursorId: z.string().optional(),
      cursorValue: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      dateInit: z.string().optional(),
      dateEnd: z.string().optional(),
      participantFilter: z.string().optional(),
      tagsFilter: z.array(z.string()).optional(),
      temperatureFilter: z.array(z.string()).optional(),
      actionFilter: z.enum(["ACTIVE", "WON", "LOST", "DELETED"]).optional(),
      projectsFilter: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const {
      statusId,
      trackingId,
      sortBy,
      cursorId,
      cursorValue,
      limit,
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
      projectsFilter,
    } = input;

    const leads = await prisma.lead.findMany({
      where: {
        statusId,
        trackingId,
        currentAction: actionFilter || "ACTIVE",
        ...buildCursorWhere(sortBy, cursorId, cursorValue),
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
        ...(projectsFilter &&
          projectsFilter.length > 0 && {
            orgProjectId: {
              in: projectsFilter,
            },
          }),
      },
      orderBy: buildOrderBy(sortBy),
      take: limit + 1,
      select: {
        id: true,
        isActive: true,
        name: true,
        email: true,
        phone: true,
        order: true,
        statusId: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        temperature: true,
        profile: true,
        responsible: {
          select: {
            image: true,
            name: true,
          },
        },
        leadTags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    let nextCursorId: string | undefined;
    let nextCursorValue: string | undefined;

    if (leads.length > limit) {
      leads.pop();
      const last = leads[leads.length - 1];
      nextCursorId = last.id;
      nextCursorValue =
        sortBy === "order" ? last.order.toString() : last[sortBy].toISOString();
    }

    return {
      leads: leads.map((lead) => ({
        ...lead,
        order: lead.order.toString(),
      })),
      nextCursorId,
      nextCursorValue,
    };
  });
