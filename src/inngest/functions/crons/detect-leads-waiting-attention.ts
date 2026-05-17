/**
 * Cron: detect-leads-waiting-attention
 *
 * A cada 5 min, varre regras `lead.waiting_attention` ativas e dispara
 * pra cada lead criado há mais de `minMinutes` que ainda NÃO recebeu
 * primeira resposta do atendente (`firstResponseAt: null`).
 *
 * Diferença vs detect-stale-leads:
 *   - stale: lead já em conversa mas parado (lastInboundAt antigo).
 *   - waiting-attention: lead recém-criado sem AINDA ter resposta.
 *
 * Idempotência: entityKey `lead-wait:<id>:<YYYY-MM-DD>` → 1× por dia
 * por lead. Cron pode rodar várias vezes sem duplicar.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { LeadAction } from "@/generated/prisma/enums";

interface WaitingAttentionParams {
  minMinutes: number;
}

export const detectLeadsWaitingAttention = inngest.createFunction(
  { id: "detect-leads-waiting-attention", retries: 1 },
  { cron: "*/5 * * * *" }, // a cada 5 min
  async ({ step }) => {
    const rules = await step.run("fetch-rules", async () =>
      prisma.alertRule.findMany({
        where: { eventType: "lead.waiting_attention", isActive: true },
        select: { id: true, organizationId: true, params: true },
      }),
    );

    if (rules.length === 0) {
      return { rulesScanned: 0, dispatched: 0 };
    }

    let totalDispatched = 0;

    for (const rule of rules) {
      const params = rule.params as unknown as WaitingAttentionParams | null;
      const minMinutes =
        params && typeof params.minMinutes === "number"
          ? params.minMinutes
          : 30;
      if (minMinutes < 1) continue;

      const cutoff = new Date(Date.now() - minMinutes * 60 * 1000);

      const waitingLeads = await step.run(
        `fetch-waiting-${rule.id}`,
        async () =>
          prisma.lead.findMany({
            where: {
              currentAction: LeadAction.ACTIVE,
              isActive: true,
              firstResponseAt: null,
              createdAt: { lt: cutoff },
              ...(rule.organizationId
                ? { tracking: { organizationId: rule.organizationId } }
                : {}),
            },
            select: {
              id: true,
              responsibleId: true,
              createdAt: true,
              tracking: { select: { organizationId: true } },
            },
            take: 500,
          }),
      );

      for (const lead of waitingLeads) {
        const refDate = new Date(lead.createdAt);
        const minutesWaiting = Math.floor(
          (Date.now() - refDate.getTime()) / (60 * 1000),
        );

        const result = await dispatchAlert("lead.waiting_attention", {
          leadId: lead.id,
          orgId: lead.tracking.organizationId,
          minutesWaiting,
          responsibleId: lead.responsibleId ?? null,
        });
        totalDispatched += result.dispatchedCount;
      }
    }

    return { rulesScanned: rules.length, dispatched: totalDispatched };
  },
);
