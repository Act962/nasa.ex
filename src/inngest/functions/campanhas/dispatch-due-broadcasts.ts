import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { beginBroadcastDispatch } from "@/features/campanhas/server/lib/begin-broadcast-dispatch";

/**
 * Scanner de campanhas agendadas (Fase 4). A cada minuto pega as campanhas
 * `SCHEDULED` cuja hora chegou (`scheduledAt <= agora`) e as coloca em disparo
 * (`SENDING` + evento `campanhas/broadcast.send`), reivindicando cada uma
 * atomicamente (`beginBroadcastDispatch`) pra evitar disparo duplo caso duas
 * execuções do cron se sobreponham. Query leve (index em `status`).
 */
export const dispatchDueBroadcasts = inngest.createFunction(
  { id: "campanhas-dispatch-due-broadcasts", retries: 1 },
  { cron: "* * * * *" },
  async ({ step }) => {
    const dueBroadcasts = await step.run("fetch-due-broadcasts", async () => {
      return prisma.broadcast.findMany({
        where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
        select: { id: true, organizationId: true },
        take: 100,
      });
    });

    if (dueBroadcasts.length === 0) return { dispatched: 0 };

    let dispatched = 0;
    for (const broadcast of dueBroadcasts) {
      const claimed = await step.run(`dispatch-${broadcast.id}`, async () => {
        return beginBroadcastDispatch({
          broadcastId: broadcast.id,
          organizationId: broadcast.organizationId,
          fromStatuses: ["SCHEDULED"],
        });
      });
      if (claimed) dispatched++;
    }

    return { dispatched };
  },
);
