import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { beginBroadcastDispatch } from "@/features/campanhas/server/lib/begin-broadcast-dispatch";

/**
 * Acompanha UMA campanha agendada até a hora dela.
 *
 * Substitui a varredura de minuto em minuto como caminho principal. Além de
 * custar um run por campanha em vez de 1.440 por dia, dispara **na hora exata**
 * — o cron acertava dentro de até um minuto.
 *
 * O cron continua existindo, em cadência baixa, como rede: pega campanha
 * agendada antes deste deploy e campanha cujo evento se perdeu.
 *
 * Dois cuidados ao acordar, porque o mundo muda enquanto se dorme:
 *  · campanha cancelada volta para `DRAFT` — o claim não pega e nada acontece;
 *  · campanha **reagendada** gera um segundo acompanhamento, e o antigo
 *    acordaria na hora errada. Por isso comparamos o `scheduledAt` do evento
 *    com o do banco: diferente significa que este acompanhamento é o velho.
 *
 * `step.sleepUntil` não consome compute enquanto dorme. O plano gratuito limita
 * cada sono a 7 dias, então agendamento distante é dormido em pedaços.
 *
 * Evento: `campanhas/broadcast.scheduled` — emitido em `campanhas.schedule`.
 */

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
/** Teto de segurança: ~6 anos de agendamento. Evita laço infinito. */
const MAX_CHUNKS = 365;

export const watchScheduledBroadcast = inngest.createFunction(
  { id: "campanhas-watch-scheduled-broadcast", retries: 2 },
  { event: "campanhas/broadcast.scheduled" },
  async ({ event, step }) => {
    const { broadcastId, organizationId, scheduledAt } = event.data as {
      broadcastId: string;
      organizationId: string;
      scheduledAt: string;
    };

    const target = new Date(scheduledAt).getTime();
    if (Number.isNaN(target)) {
      return { broadcastId, skipped: "invalid_scheduled_at" as const };
    }

    // Dentro de um step para o plano de espera ser memoizado: recalcular a
    // cada replay daria contas diferentes.
    const plan = await step.run("plano-de-espera", () => {
      const startedAt = Date.now();
      const chunks = Math.min(
        MAX_CHUNKS,
        Math.max(1, Math.ceil((target - startedAt) / SIX_DAYS_MS)),
      );
      return { startedAt, chunks };
    });

    for (let chunk = 1; chunk <= plan.chunks; chunk += 1) {
      const wakeAt = Math.min(plan.startedAt + chunk * SIX_DAYS_MS, target);
      await step.sleepUntil(`espera-${chunk}`, new Date(wakeAt));
    }

    return step.run("disparar", async () => {
      const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
        select: { status: true, scheduledAt: true },
      });

      if (!broadcast) return { broadcastId, skipped: "not_found" as const };
      if (broadcast.status !== "SCHEDULED") {
        return { broadcastId, skipped: "not_scheduled" as const };
      }
      if (broadcast.scheduledAt?.toISOString() !== new Date(scheduledAt).toISOString()) {
        return { broadcastId, skipped: "rescheduled" as const };
      }

      const claimed = await beginBroadcastDispatch({
        broadcastId,
        organizationId,
        fromStatuses: ["SCHEDULED"],
      });

      return { broadcastId, dispatched: Boolean(claimed) };
    });
  },
);
