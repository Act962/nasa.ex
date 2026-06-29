/**
 * Cron: detect-actions-due-soon
 *
 * A cada 10 min, varre regras `action.due_soon` ativas e dispara pra
 * cada Action que está pra vencer dentro da janela `hoursBefore`
 * (default 1h), ainda não concluída.
 *
 * Diferença vs detect-overdue:
 *   - overdue: dueDate JÁ passou.
 *   - due_soon: dueDate vai passar em < hoursBefore.
 *
 * Idempotência: entityKey `action-soon:<id>:<YYYY-MM-DD>` → 1× por dia
 * por action.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

interface DueSoonParams {
  hoursBefore: number;
}

export const detectActionsDueSoon = inngest.createFunction(
  { id: "detect-actions-due-soon", retries: 1 },
  { cron: "0 * * * *" }, // hora em hora
  async ({ step }) => {
    const rules = await step.run("fetch-rules", async () =>
      prisma.alertRule.findMany({
        where: { eventType: "action.due_soon", isActive: true },
        select: { id: true, organizationId: true, params: true },
      }),
    );

    if (rules.length === 0) {
      return { rulesScanned: 0, dispatched: 0 };
    }

    let totalDispatched = 0;
    const now = Date.now();

    for (const rule of rules) {
      const params = rule.params as unknown as DueSoonParams | null;
      const hoursBefore =
        params && typeof params.hoursBefore === "number"
          ? params.hoursBefore
          : 1;
      if (hoursBefore < 1) continue;

      const cutoff = new Date(now + hoursBefore * 60 * 60 * 1000);

      const dueActions = await step.run(
        `fetch-due-soon-${rule.id}`,
        async () =>
          prisma.action.findMany({
            where: {
              isDone: false,
              isArchived: false,
              dueDate: {
                gt: new Date(now),  // ainda não venceu
                lte: cutoff,        // mas vai vencer dentro da janela
              },
              ...(rule.organizationId
                ? { organizationId: rule.organizationId }
                : {}),
            },
            select: {
              id: true,
              createdBy: true,
              dueDate: true,
              organizationId: true,
            },
            take: 500,
          }),
      );

      for (const action of dueActions) {
        if (!action.organizationId || !action.dueDate) continue;
        const minutesUntil = Math.floor(
          (new Date(action.dueDate).getTime() - now) / (60 * 1000),
        );

        const result = await dispatchAlert("action.due_soon", {
          actionId: action.id,
          userId: action.createdBy,
          orgId: action.organizationId,
          minutesUntil,
        });
        totalDispatched += result.dispatchedCount;
      }
    }

    return { rulesScanned: rules.length, dispatched: totalDispatched };
  },
);
