/**
 * Cron: detect-lead-waiting (spec 0029, RF-4)
 *
 * A cada 2 min, acha leads cuja última mensagem é deles e está sem resposta há
 * `waitingMinutes` (padrão 5). Qualquer resposta — humana ou automática — zera
 * a espera, porque o lead foi atendido.
 *
 * Idempotência: `entityKey` usa o início da espera (`lastInboundAt`), então
 * cada espera alerta uma vez só; uma nova mensagem depois da resposta abre uma
 * espera nova (CA-2).
 */

import type { GetStepTools } from "inngest";
import type { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { waitingLeadWhere } from "@/features/alerts/lib/waiting-lead";

interface WaitingParams {
  waitingMinutes?: number;
}

const DEFAULT_WAITING_MINUTES = 5;
/** Teto por regra por execução; o resto entra na rodada seguinte (CB-4). */
const BATCH_LIMIT = 200;

/** Escopo opcional: só esta org (bateria de QA). O cron roda sem escopo. */
export interface DetectionScope {
  organizationId?: string;
}

export async function runLeadWaitingDetection(
  step: Pick<GetStepTools<typeof inngest>, "run">,
  scope: DetectionScope = {},
) {
  const rules = await step.run("fetch-rules", () =>
    prisma.alertRule.findMany({
      where: {
        eventType: "chat.lead_waiting",
        isActive: true,
        ...(scope.organizationId
          ? {
              OR: [
                { organizationId: null },
                { organizationId: scope.organizationId },
              ],
            }
          : {}),
      },
      select: { id: true, organizationId: true, params: true },
    }),
  );
  if (rules.length === 0) return { rulesScanned: 0, dispatched: 0 };

  let dispatched = 0;
  const now = Date.now();

  for (const rule of rules) {
    const params = (rule.params ?? {}) as WaitingParams;
    const waitingMinutes =
      typeof params.waitingMinutes === "number" && params.waitingMinutes > 0
        ? params.waitingMinutes
        : DEFAULT_WAITING_MINUTES;

    const waitingLeads = await step.run(`fetch-waiting-${rule.id}`, () =>
      prisma.lead.findMany({
        where: {
          ...waitingLeadWhere(now, waitingMinutes),
          ...(scope.organizationId
            ? { tracking: { organizationId: scope.organizationId } }
            : rule.organizationId
              ? { tracking: { organizationId: rule.organizationId } }
              : {}),
        },
        orderBy: { lastInboundAt: "asc" },
        take: BATCH_LIMIT,
        select: {
          id: true,
          name: true,
          responsibleId: true,
          lastInboundAt: true,
          conversation: { select: { id: true } },
          tracking: { select: { organizationId: true } },
        },
      }),
    );

    // Um passo por lote, não por lead: o Inngest limita passos por execução.
    dispatched += await step.run(`dispatch-${rule.id}`, async () => {
      let ruleDispatched = 0;
      for (const lead of waitingLeads) {
        if (!lead.conversation || !lead.lastInboundAt) continue;
        const waitingSince = new Date(lead.lastInboundAt);
        const result = await dispatchAlert("chat.lead_waiting", {
          conversationId: lead.conversation.id,
          leadId: lead.id,
          leadName: lead.name,
          responsibleId: lead.responsibleId,
          waitingMinutes: Math.max(
            waitingMinutes,
            Math.round((Date.now() - waitingSince.getTime()) / 60_000),
          ),
          waitingSince: waitingSince.toISOString(),
          actionUrl: `/tracking-chat/${lead.conversation.id}`,
          orgId: lead.tracking.organizationId,
        });
        ruleDispatched += result.dispatchedCount;
      }
      return ruleDispatched;
    });
  }

  return { rulesScanned: rules.length, dispatched };
}
