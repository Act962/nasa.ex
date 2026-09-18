import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { beginBroadcastDispatch } from "@/features/campanhas/server/lib/begin-broadcast-dispatch";

/**
 * Rede de segurança do disparo agendado (Fase 4).
 *
 * O caminho principal é `watch-scheduled-broadcast`, agendado por campanha no
 * momento em que ela é marcada — dispara na hora exata. Este cron existe para o
 * que aquele não cobre: campanha agendada antes do deploy que introduziu o
 * acompanhamento, e evento de agendamento que se perdeu.
 *
 * Rodava de minuto em minuto (1.440 execuções/dia) quando era o caminho
 * principal. Como rede, 15 minutos bastam: o atraso só aparece se o
 * acompanhamento tiver falhado, e antes disso ele nem existia.
 *
 * Disparo duplo não é risco: `beginBroadcastDispatch` reivindica a campanha
 * atomicamente, então quem chegar depois não faz nada.
 */
export const dispatchDueBroadcasts = inngest.createFunction(
  { id: "campanhas-dispatch-due-broadcasts", retries: 1 },
  { cron: "*/15 * * * *" },
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
