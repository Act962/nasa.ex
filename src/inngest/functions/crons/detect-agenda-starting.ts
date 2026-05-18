/**
 * Cron: detect-agenda-starting
 *
 * Roda a CADA MINUTO — varre regras `agenda.starting_soon` ativas e dispara
 * alerta pra appointments que vão começar dentro de `minutesBefore`.
 *
 * Por que 1 min? `minutesBefore` mínimo do paramsSchema é 1 — se o cron
 * rodasse a cada 5 min como antes, regras com antecedência < 5 min eram
 * uma roleta (só pegava o appt se ele começasse no minuto exato do tick).
 *
 * Idempotência: AlertDispatch entityKey="agenda-start:<appointmentId>" —
 * dispara só 1× por appointment, mesmo que o cron rode 60×/h.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

interface StartingParams {
  minutesBefore: number;
}

const SAFETY_MARGIN_SEC = 30;

export const detectAgendaStarting = inngest.createFunction(
  { id: "detect-agenda-starting", retries: 1 },
  { cron: "* * * * *" }, // a cada 1 min — necessário pra minutesBefore=1
  async ({ step }) => {
    const rules = await step.run("fetch-rules", async () =>
      prisma.alertRule.findMany({
        where: { eventType: "agenda.starting_soon", isActive: true },
        select: { id: true, organizationId: true, params: true },
      }),
    );

    if (rules.length === 0) {
      return { rulesScanned: 0, dispatched: 0 };
    }

    let totalDispatched = 0;

    for (const rule of rules) {
      const params = rule.params as unknown as StartingParams | null;
      const minutesBefore =
        params && typeof params.minutesBefore === "number"
          ? params.minutesBefore
          : 0;
      if (!minutesBefore || minutesBefore < 1) continue;

      // Janela: [now - 30s, now + minutesBefore*60s + 30s]
      // 30s de buffer pra cobrir jitter de scheduling do Inngest.
      // Idempotência protege contra duplicação se o cron disparar 2x na mesma janela.
      const start = new Date(Date.now() - SAFETY_MARGIN_SEC * 1000);
      const end = new Date(
        Date.now() + minutesBefore * 60_000 + SAFETY_MARGIN_SEC * 1000,
      );

      const upcoming = await step.run(`fetch-upcoming-${rule.id}`, async () =>
        prisma.appointment.findMany({
          where: {
            status: { in: ["PENDING", "CONFIRMED"] },
            startsAt: { gte: start, lte: end },
            ...(rule.organizationId
              ? { agenda: { organizationId: rule.organizationId } }
              : {}),
          },
          select: {
            id: true,
            startsAt: true,
            userId: true,
            agenda: { select: { organizationId: true } },
          },
          take: 200,
        }),
      );

      for (const appt of upcoming) {
        const startsAt = new Date(appt.startsAt);
        const minutesUntil = Math.max(
          0,
          Math.round((startsAt.getTime() - Date.now()) / 60_000),
        );

        const result = await dispatchAlert("agenda.starting_soon", {
          appointmentId: appt.id,
          startsAt: startsAt.toISOString(),
          minutesUntil,
          orgId: appt.agenda.organizationId,
          participantUserIds: appt.userId ? [appt.userId] : [],
        });
        totalDispatched += result.dispatchedCount;
      }
    }

    return { rulesScanned: rules.length, dispatched: totalDispatched };
  },
);
