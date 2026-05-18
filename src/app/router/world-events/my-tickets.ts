import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista ingressos do user atual.
 *
 * Inclui dados básicos do evento pra UI poder mostrar "evento começa em
 * 2h" sem segundo round-trip.
 */
export const listMyTickets = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/world-events/my-tickets",
    summary: "Lista ingressos de WorldEvent do user",
  })
  .input(
    z.object({
      includeExpired: z.boolean().optional().default(false),
    }),
  )
  .output(
    z.object({
      items: z.array(
        z.object({
          ticketId: z.string(),
          accessToken: z.string(),
          status: z.string(),
          redeemedAt: z.string().nullable(),
          createdAt: z.string(),
          event: z.object({
            id: z.string(),
            slug: z.string(),
            title: z.string(),
            coverUrl: z.string().nullable(),
            startsAt: z.string(),
            endsAt: z.string(),
            status: z.string(),
            stationNick: z.string().nullable(),
          }),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const tickets = await prisma.worldEventTicket.findMany({
      where: {
        holderUserId: context.user.id,
        ...(input.includeExpired
          ? {}
          : { status: { in: ["ACTIVE"] as const } }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        worldEvent: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverUrl: true,
            startsAt: true,
            endsAt: true,
            status: true,
            station: { select: { nick: true } },
          },
        },
      },
    });

    return {
      items: tickets.map((t) => ({
        ticketId: t.id,
        accessToken: t.accessToken,
        status: t.status,
        redeemedAt: t.redeemedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        event: {
          id: t.worldEvent.id,
          slug: t.worldEvent.slug,
          title: t.worldEvent.title,
          coverUrl: t.worldEvent.coverUrl,
          startsAt: t.worldEvent.startsAt.toISOString(),
          endsAt: t.worldEvent.endsAt.toISOString(),
          status: t.worldEvent.status,
          stationNick: t.worldEvent.station?.nick ?? null,
        },
      })),
    };
  });
