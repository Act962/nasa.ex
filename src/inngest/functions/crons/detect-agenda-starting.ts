/**
 * detect-agenda-starting — roda no ticker de 15 minutos (`crons/polling-tickers.ts`).
 *
 * Varre regras `agenda.starting_soon` ativas e dispara alerta pra appointments
 * que vão começar dentro de `minutesBefore` (regras devem usar >= 15).
 *
 * Idempotência: AlertDispatch entityKey="agenda-start:<appointmentId>" —
 * dispara só 1× por appointment, mesmo que o tick pegue o mesmo appt de novo.
 */

import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import type { InlineStep } from "@/inngest/inline-step";

interface StartingParams {
  minutesBefore: number;
}

const SAFETY_MARGIN_SEC = 30;

export async function runDetectAgendaStarting(step: InlineStep) {
  // Early exit fora de step.run pra não consumir step do Free tier
  // quando não há regras ativas (cron roda 1440x/dia).
  const activeRulesCount = await prisma.alertRule.count({
    where: { eventType: "agenda.starting_soon", isActive: true },
  });

  if (activeRulesCount === 0) {
    return { rulesScanned: 0, dispatched: 0 };
  }

  const rules = await step.run("fetch-rules", async () =>
    prisma.alertRule.findMany({
      where: { eventType: "agenda.starting_soon", isActive: true },
      select: { id: true, organizationId: true, params: true },
    }),
  );

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
}
