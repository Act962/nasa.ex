import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Estatísticas de ocupação atual de um WorldEvent.
 *
 * Fonte de verdade: `worldEvent.currentOccupancy` atualizado a cada 30s
 * por um Inngest cron (best-effort). Não é autoritativo — usar pra UI,
 * não pra capacity gating crítico.
 */
export const getEventOccupancy = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/world-events/get-occupancy",
    summary: "Estatísticas de ocupação do evento",
  })
  .input(z.object({ eventId: z.string() }))
  .output(
    z.object({
      eventId: z.string(),
      capacity: z.number(),
      currentOccupancy: z.number(),
      utilization: z.number(), // 0-1
      // Tickets vendidos no total (referência pra organizador)
      ticketsSold: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.worldEvent.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        capacity: true,
        currentOccupancy: true,
        isPublic: true,
        station: { select: { userId: true, orgId: true } },
      },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado." });

    if (!event.isPublic) {
      const isMember =
        event.station?.userId === context.user.id ||
        (event.station?.orgId !== null &&
          event.station?.orgId === context.session.activeOrganizationId);
      if (!isMember) throw errors.FORBIDDEN({ message: "Evento privado." });
    }

    const ticketsSold = await prisma.worldEventTicket.count({
      where: { worldEventId: event.id, status: "ACTIVE" },
    });

    return {
      eventId: event.id,
      capacity: event.capacity,
      currentOccupancy: event.currentOccupancy,
      utilization:
        event.capacity > 0
          ? Math.min(1, event.currentOccupancy / event.capacity)
          : 0,
      ticketsSold,
    };
  });
