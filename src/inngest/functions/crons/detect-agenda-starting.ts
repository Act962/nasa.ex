/**
 * Cron: detect-agenda-starting
 *
 * A cada 5 min, dispara alertas pra agendamentos que estão prestes a começar
 * em [now+N-5min, now+N], onde N = `minutesBefore` da regra.
 *
 * Por que separado do check-reminders? check-reminders é event-driven
 * (Reminder.nextRemindAt + step.sleepUntil) e dispara WhatsApp + notif
 * passiva. Esta detecção é varredor pra eventos que NÃO têm Reminder
 * configurado mas que a empresa quer alertar com severidade configurável.
 *
 * Idempotência: AlertDispatch entityKey="agenda-start:<appointmentId>" —
 * dispara só 1× por appointment.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

interface StartingParams {
  minutesBefore: number;
}

export const detectAgendaStarting = inngest.createFunction(
  { id: "detect-agenda-starting", retries: 1 },
  { cron: "*/5 * * * *" }, // a cada 5 min
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

      // Janela: [now + (N-5)min, now + N min]
      // 5 min de janela = sobrepõe com o próximo run (cron 5 min) → catch sem gap.
      // Idempotência protege contra duplicação.
      const start = new Date(Date.now() + (minutesBefore - 5) * 60_000);
      const end = new Date(Date.now() + minutesBefore * 60_000);

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
