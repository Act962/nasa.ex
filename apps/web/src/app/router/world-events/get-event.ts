import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Detalhes de um WorldEvent por slug.
 *
 * Sempre acessível pra eventos `isPublic`. Pra privados, exige ser
 * membro da org host (validado num futuro middleware, por enquanto
 * negamos acesso a privados nesse endpoint público).
 */
export const getWorldEvent = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/world-events/get",
    summary: "Detalhes de um WorldEvent por slug",
  })
  .input(z.object({ slug: z.string().min(1) }))
  .output(
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
      mapData: z.unknown(),
      zones: z.unknown(),
      capacity: z.number(),
      currentOccupancy: z.number(),
      ticketPriceStars: z.number().nullable(),
      ticketPriceBrl: z.number().nullable(),
      isFree: z.boolean(),
      isPublic: z.boolean(),
      payoutPercent: z.number(),
      status: z.string(),
      createdBy: z.string(),
      // Ingresso ativo do user atual pra esse evento (se houver).
      myTicket: z
        .object({
          id: z.string(),
          accessToken: z.string(),
          status: z.string(),
          redeemedAt: z.string().nullable(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.worldEvent.findUnique({
      where: { slug: input.slug },
      include: {
        station: { select: { nick: true, orgId: true } },
      },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado." });

    if (!event.isPublic) {
      // Permitir se user é admin/membro da org host. Por agora bloqueamos
      // não-membros explicitamente.
      const orgId = event.station?.orgId ?? null;
      if (!orgId) throw errors.FORBIDDEN({ message: "Evento privado." });
      const isMember = await prisma.member.findFirst({
        where: { organizationId: orgId, userId: context.user.id },
        select: { id: true },
      });
      if (!isMember) throw errors.FORBIDDEN({ message: "Evento privado." });
    }

    const myTicket = await prisma.worldEventTicket.findFirst({
      where: {
        worldEventId: event.id,
        holderUserId: context.user.id,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        accessToken: true,
        status: true,
        redeemedAt: true,
      },
    });

    return {
      id: event.id,
      stationId: event.stationId,
      stationNick: event.station?.nick ?? null,
      slug: event.slug,
      title: event.title,
      description: event.description,
      coverUrl: event.coverUrl,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      mapData: event.mapData,
      zones: event.zones,
      capacity: event.capacity,
      currentOccupancy: event.currentOccupancy,
      ticketPriceStars: event.ticketPriceStars,
      ticketPriceBrl: event.ticketPriceBrl
        ? Number(event.ticketPriceBrl)
        : null,
      isFree: event.isFree,
      isPublic: event.isPublic,
      payoutPercent: event.payoutPercent,
      status: event.status,
      createdBy: event.createdBy,
      myTicket: myTicket
        ? {
            id: myTicket.id,
            accessToken: myTicket.accessToken,
            status: myTicket.status,
            redeemedAt: myTicket.redeemedAt?.toISOString() ?? null,
          }
        : null,
    };
  });
