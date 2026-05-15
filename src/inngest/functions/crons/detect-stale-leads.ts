/**
 * Cron: detect-stale-leads
 *
 * A cada 30 min, varre regras de alerta `lead.stale` ativas e dispara
 * pra cada lead ativo (ACTIVE) cujo `lastInboundAt` ultrapassou os dias
 * configurados na regra.
 *
 * Idempotência: o `dispatchAlert` usa AlertDispatch unique (alertRuleId,
 * entityKey) — entityKey é "lead-stale:<id>:<YYYY-MM-DD>", então cada
 * lead só dispara 1× por dia mesmo se o cron rodar várias vezes.
 *
 * Performance: percorre regras 1×, lê leads filtrados, faz batch de
 * dispatches. Pra orgs grandes o gargalo será o número de regras ativas,
 * não o número de leads (a query usa índice em `lastInboundAt`).
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { LeadAction } from "@/generated/prisma/enums";

interface StaleParams {
  days: number;
}

export const detectStaleLeads = inngest.createFunction(
  { id: "detect-stale-leads", retries: 1 },
  { cron: "*/30 * * * *" }, // a cada 30 min
  async ({ step }) => {
    const rules = await step.run("fetch-rules", async () =>
      prisma.alertRule.findMany({
        where: { eventType: "lead.stale", isActive: true },
        select: {
          id: true,
          organizationId: true,
          params: true,
        },
      }),
    );

    if (rules.length === 0) {
      return { rulesScanned: 0, dispatched: 0 };
    }

    let totalDispatched = 0;

    for (const rule of rules) {
      const params = rule.params as unknown as StaleParams | null;
      const days = params && typeof params.days === "number" ? params.days : 0;
      if (!days || days < 1) continue;

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Lead ativo cujo lastInboundAt é antigo OU null + createdAt antigo
      // (lead que nunca recebeu mensagem inbound conta como "parado" também).
      const staleLeads = await step.run(`fetch-stale-${rule.id}`, async () =>
        prisma.lead.findMany({
          where: {
            currentAction: LeadAction.ACTIVE,
            isActive: true,
            ...(rule.organizationId
              ? { tracking: { organizationId: rule.organizationId } }
              : {}),
            OR: [
              { lastInboundAt: { lt: cutoff } },
              { lastInboundAt: null, createdAt: { lt: cutoff } },
            ],
          },
          select: {
            id: true,
            responsibleId: true,
            lastInboundAt: true,
            createdAt: true,
            tracking: { select: { organizationId: true } },
          },
          // Cap defensivo — se uma org tem milhões de leads parados, processa
          // em chunks futuros (Inngest step.run paginado). Por enquanto: 500/run.
          take: 500,
        }),
      );

      for (const lead of staleLeads) {
        // step.run serializa Date → string; reconstrói pra calcular delta.
        const refDate = new Date(lead.lastInboundAt ?? lead.createdAt);
        const daysSilent = Math.floor(
          (Date.now() - refDate.getTime()) / (24 * 60 * 60 * 1000),
        );

        const result = await dispatchAlert("lead.stale", {
          leadId: lead.id,
          daysSilent,
          orgId: lead.tracking.organizationId,
          responsibleId: lead.responsibleId ?? null,
        });
        totalDispatched += result.dispatchedCount;
      }
    }

    return { rulesScanned: rules.length, dispatched: totalDispatched };
  },
);
