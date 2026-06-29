import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista eventos visíveis.
 *
 * Visibilidade:
 *   - `isPublic === true` → todo mundo vê (até user sem org ativa).
 *   - Internos da station host → veem mesmo se privado (futuro).
 *
 * Filtros opcionais:
 *   - stationId: só eventos hospedados por uma station.
 *   - status: SCHEDULED | LIVE | ENDED | CANCELLED.
 *
 * Paginado 20/p, ordenado por startsAt asc (próximos primeiro).
 */
export const listWorldEvents = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/world-events/list",
    summary: "Lista WorldEvents visíveis ao usuário",
  })
  .input(
    z.object({
      stationId: z.string().optional(),
      status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }),
  )
  .output(
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          stationId: z.string(),
          stationNick: z.string().nullable(),
          slug: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          coverUrl: z.string().nullable(),
          startsAt: z.string(),
          endsAt: z.string(),
          capacity: z.number(),
          currentOccupancy: z.number(),
          ticketPriceStars: z.number().nullable(),
          ticketPriceBrl: z.number().nullable(),
          isFree: z.boolean(),
          isPublic: z.boolean(),
          status: z.string(),
        }),
      ),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      hasMore: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const where = {
      isPublic: true,
      ...(input.stationId ? { stationId: input.stationId } : {}),
      ...(input.status ? { status: input.status } : {}),
    } as const;

    const [items, total] = await Promise.all([
      prisma.worldEvent.findMany({
        where,
        orderBy: [{ startsAt: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          station: { select: { nick: true } },
        },
      }),
      prisma.worldEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        stationId: e.stationId,
        stationNick: e.station?.nick ?? null,
        slug: e.slug,
        title: e.title,
        description: e.description,
        coverUrl: e.coverUrl,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        capacity: e.capacity,
        currentOccupancy: e.currentOccupancy,
        ticketPriceStars: e.ticketPriceStars,
        ticketPriceBrl: e.ticketPriceBrl ? Number(e.ticketPriceBrl) : null,
        isFree: e.isFree,
        isPublic: e.isPublic,
        status: e.status,
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: input.page * input.pageSize < total,
    };
  });
