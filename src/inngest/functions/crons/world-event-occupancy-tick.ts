/**
 * Cron: world-event-occupancy-tick
 *
 * Roda a cada 1 min. Pra cada WorldEvent LIVE/SCHEDULED na janela ativa
 * (startsAt - 30min ≤ now ≤ endsAt + 5min), atualiza:
 *   - currentOccupancy: hoje conta tickets que tiveram redeemedAt nas
 *     últimas 5 min (proxy de "presente no mapa"). Fase 2 troca pra
 *     consulta direta no presence channel.
 *   - status: SCHEDULED → LIVE quando startsAt ≤ now. LIVE → ENDED quando
 *     endsAt < now.
 *   - Dispara alerta `world.event_near_capacity` quando >= 80% (via
 *     eventBus do sistema de alertas, com idempotência por dia).
 *
 * Best-effort: nada crítico depende disso. Pra MVP é suficiente.
 *
 * Pré-requisito: o evento `world.event_near_capacity` precisa estar no
 * `alert-catalog.ts` pra que o engine de alertas processe e crie a
 * AdminNotification. Adicione no catálogo separadamente (ver PR de
 * Notificações Inteligentes #54).
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { eventBus } from "@/features/alerts/lib/event-bus";

const PRESENCE_WINDOW_MS = 5 * 60 * 1000; // 5min
const ALERT_THRESHOLD = 0.8;

export const worldEventOccupancyTick = inngest.createFunction(
  { id: "world-event-occupancy-tick", retries: 1 },
  { cron: "* * * * *" }, // a cada minuto
  async ({ step }) => {
    const now = new Date();
    const windowOpen = new Date(now.getTime() - 30 * 60 * 1000);
    const windowClose = new Date(now.getTime() + 5 * 60 * 1000);

    const events = await step.run("fetch-active-events", async () =>
      prisma.worldEvent.findMany({
        where: {
          status: { in: ["SCHEDULED", "LIVE"] },
          startsAt: { lte: windowClose },
          endsAt: { gte: windowOpen },
        },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          currentOccupancy: true,
          stationId: true,
          station: { select: { orgId: true } },
        },
        take: 200,
      }),
    );

    let updated = 0;

    for (const e of events) {
      // Conta tickets resgatados nas últimas 5min como "presentes".
      const presentCount = await prisma.worldEventTicket.count({
        where: {
          worldEventId: e.id,
          status: "ACTIVE",
          redeemedAt: { gte: new Date(Date.now() - PRESENCE_WINDOW_MS) },
        },
      });

      // Transição de status. `startsAt`/`endsAt` podem vir como Date OU
      // string (Inngest step.run serializa Date → ISO string ao salvar
      // o checkpoint). Normaliza com new Date() pra ser seguro nos 2 casos.
      let nextStatus = e.status;
      const startsAtMs = new Date(e.startsAt).getTime();
      const endsAtMs = new Date(e.endsAt).getTime();
      const nowMs = now.getTime();
      if (e.status === "SCHEDULED" && startsAtMs <= nowMs) {
        nextStatus = "LIVE";
      }
      if (endsAtMs < nowMs && e.status !== "ENDED") {
        nextStatus = "ENDED";
      }

      if (
        presentCount !== e.currentOccupancy ||
        nextStatus !== e.status
      ) {
        await prisma.worldEvent.update({
          where: { id: e.id },
          data: {
            currentOccupancy: presentCount,
            status: nextStatus,
          },
        });
        updated++;
      }

      // Alerta de capacidade alta
      const utilization = e.capacity > 0 ? presentCount / e.capacity : 0;
      if (utilization >= ALERT_THRESHOLD && e.station?.orgId) {
        await eventBus.publish("world.event_near_capacity", {
          eventId: e.id,
          orgId: e.station.orgId,
          utilization: Math.round(utilization * 100),
          currentOccupancy: presentCount,
          capacity: e.capacity,
        });
      }
    }

    return { scanned: events.length, updated };
  },
);
