/**
 * Cron: detect-form-abandoned
 *
 * A cada 15 min, varre regras `form.abandoned` ativas e dispara pra
 * FormResponses que foram iniciadas (via save-partial-response) mas não
 * finalizadas em N minutos.
 *
 * Schema:
 *   - completedAt NULL → resposta nunca chegou ao submit
 *   - createdAt < now - N min → o "tempo de espera" passou
 *
 * Idempotência: entityKey="form-abandon:<responseId>" — dispara só 1×
 * por resposta abandonada (mesmo que o cron rode múltiplas vezes).
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

interface AbandonedParams {
  minutes: number;
}

export const detectFormAbandoned = inngest.createFunction(
  { id: "detect-form-abandoned", retries: 1 },
  { cron: "*/15 * * * *" }, // a cada 15 min
  async ({ step }) => {
    const rules = await step.run("fetch-rules", async () =>
      prisma.alertRule.findMany({
        where: { eventType: "form.abandoned", isActive: true },
        select: { id: true, organizationId: true, params: true },
      }),
    );

    if (rules.length === 0) {
      return { rulesScanned: 0, dispatched: 0 };
    }

    let totalDispatched = 0;

    for (const rule of rules) {
      const params = rule.params as unknown as AbandonedParams | null;
      const minutes =
        params && typeof params.minutes === "number" ? params.minutes : 0;
      if (!minutes || minutes < 1) continue;

      const cutoff = new Date(Date.now() - minutes * 60_000);

      const abandoned = await step.run(`fetch-abandoned-${rule.id}`, async () =>
        prisma.formResponses.findMany({
          where: {
            completedAt: null,
            createdAt: { lt: cutoff },
            ...(rule.organizationId
              ? { form: { organizationId: rule.organizationId } }
              : {}),
          },
          select: {
            id: true,
            formId: true,
            form: { select: { organizationId: true } },
          },
          take: 200,
        }),
      );

      for (const r of abandoned) {
        const result = await dispatchAlert("form.abandoned", {
          formId: r.formId,
          responseId: r.id,
          orgId: r.form.organizationId,
        });
        totalDispatched += result.dispatchedCount;
      }
    }

    return { rulesScanned: rules.length, dispatched: totalDispatched };
  },
);
