import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { mintLiveKitToken, isLiveKitConfigured } from "@/lib/livekit/server";

/**
 * Redeem (resgate) de ingresso pra entrar no WorldEvent.
 *
 * Valida:
 *   - Token existe + ACTIVE.
 *   - Evento dentro da janela (não cancelado, não acabou).
 *   - Capacidade não estourada (soft check via `currentOccupancy`).
 *
 * Retorna:
 *   - mapData + zones (cliente monta Phaser).
 *   - `presenceChannel` (qual canal Pusher subscribe — futuro: por region).
 *   - `sfuStageToken` (token LiveKit pré-mintado pra `stage` zone do evento).
 *     Speaker/audience inferido por ownership da station (host = speaker).
 *
 * Side effect: marca `redeemedAt` na primeira vez.
 */
export const redeemTicket = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/world-events/redeem-ticket",
    summary: "Resgata ingresso e abre acesso ao WorldEvent",
  })
  .input(z.object({ accessToken: z.string().min(8) }))
  .output(
    z.object({
      eventId: z.string(),
      slug: z.string(),
      title: z.string(),
      mapData: z.unknown(),
      zones: z.unknown(),
      presenceChannel: z.string(), // "presence-world-event-<id>"
      sfuStageToken: z.string().nullable(),
      sfuStageRoom: z.string().nullable(),
      sfuWsUrl: z.string().nullable(),
      role: z.enum(["speaker", "audience", "moderator"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const ticket = await prisma.worldEventTicket.findUnique({
      where: { accessToken: input.accessToken },
      include: {
        worldEvent: {
          include: {
            station: { select: { userId: true, orgId: true } },
          },
        },
      },
    });
    if (!ticket) throw errors.NOT_FOUND({ message: "Ingresso inválido." });
    if (ticket.status !== "ACTIVE") {
      throw errors.FORBIDDEN({ message: "Ingresso revogado ou expirado." });
    }
    if (ticket.holderUserId !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Este ingresso pertence a outro usuário.",
      });
    }

    const event = ticket.worldEvent;
    if (event.status === "CANCELLED") {
      throw errors.BAD_REQUEST({ message: "Evento cancelado." });
    }
    if (event.endsAt.getTime() < Date.now()) {
      throw errors.BAD_REQUEST({ message: "Evento já terminou." });
    }
    // Capacity guard (soft): currentOccupancy é atualizado por cron a cada 30s.
    if (event.currentOccupancy >= event.capacity) {
      throw errors.BAD_REQUEST({
        message: `Evento lotado (${event.currentOccupancy}/${event.capacity}).`,
      });
    }

    // Determina role: dono da station/org host vira moderator. Demais
    // entram como audience (podem virar speaker dentro do evento se o
    // organizador promovê-los — futuro).
    const isHost =
      event.station?.userId === context.user.id ||
      (event.station?.orgId !== null &&
        event.station?.orgId === context.session.activeOrganizationId);
    const role: "speaker" | "audience" | "moderator" = isHost
      ? "moderator"
      : "audience";

    // Mint LiveKit token pro palco (stage zone), se SFU configurado.
    let sfuStageToken: string | null = null;
    let sfuStageRoom: string | null = null;
    let sfuWsUrl: string | null = null;
    if (isLiveKitConfigured()) {
      sfuStageRoom = `event:${event.id}:stage`;
      sfuWsUrl =
        process.env.LIVEKIT_WS_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null;
      try {
        sfuStageToken = await mintLiveKitToken({
          roomName: sfuStageRoom,
          identity: context.user.id,
          name: context.user.name ?? undefined,
          role,
          ttlSeconds: 6 * 60 * 60,
          metadata: { eventId: event.id, stationId: event.stationId },
        });
      } catch (err) {
        console.warn("[redeem-ticket] LiveKit mint falhou:", err);
      }
    }

    // Marca redeemedAt na primeira vez.
    if (!ticket.redeemedAt) {
      await prisma.worldEventTicket.update({
        where: { id: ticket.id },
        data: { redeemedAt: new Date() },
      });
    }

    return {
      eventId: event.id,
      slug: event.slug,
      title: event.title,
      mapData: event.mapData,
      zones: event.zones,
      presenceChannel: `presence-world-event-${event.id}`,
      sfuStageToken,
      sfuStageRoom,
      sfuWsUrl,
      role,
    };
  });
