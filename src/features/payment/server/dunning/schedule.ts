import "server-only";

import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";

/**
 * Agenda os eventos Inngest pra TODOS os steps de uma régua aplicada a um entry.
 *
 * Modelo event-driven (decisão fechada com user — sem cron unconditional):
 *   - Pra cada step da rule, calcula `fireAt = entry.dueDate + step.daysOffset`.
 *   - Se `fireAt > now`, envia evento `payment/dunning.fire` com `ts: fireAt`.
 *     Inngest "dorme" até o timestamp e dispara o handler 1 vez.
 *   - Se `fireAt <= now`, ignora (não vamos disparar steps retroativos sem
 *     ação explícita do user — evita inundar contato com mensagens passadas).
 *   - Idempotência via `id` único derivado de (entryId, stepId): se mesmo
 *     evento for enviado de novo (re-atribuição), Inngest deduplica.
 *
 * Chamado em:
 *   - `createPaymentEntry` quando `dunningRuleId` é setado E `type=RECEIVABLE`.
 *   - `assignDunningRule` quando o user atribui régua a entry existente.
 *
 * Quando o entry é UPDATED com novo `dunningRuleId` ou `dueDate`:
 *   - Re-chama essa função (eventos novos com IDs diferentes pra cada step).
 *   - Eventos antigos ainda chegam mas o handler é idempotente (vê que tem
 *     `PaymentDunningExecution` com `(entryId, stepId)` ou status final → skip).
 */
export async function scheduleDunningForEntry(entryId: string) {
  const entry = await prisma.paymentEntry.findUnique({
    where: { id: entryId },
    select: {
      id:             true,
      organizationId: true,
      type:           true,
      status:         true,
      dueDate:        true,
      dunningRuleId:  true,
    },
  });
  if (!entry) return { scheduled: 0, reason: "entry-not-found" };
  if (entry.type !== "RECEIVABLE") return { scheduled: 0, reason: "not-receivable" };
  if (!entry.dunningRuleId) return { scheduled: 0, reason: "no-rule" };
  if (["PAID", "CANCELLED"].includes(entry.status)) {
    return { scheduled: 0, reason: "terminal-status" };
  }

  const rule = await prisma.paymentDunningRule.findUnique({
    where: { id: entry.dunningRuleId },
    include: {
      steps: {
        where: { enabled: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!rule || !rule.isActive) return { scheduled: 0, reason: "rule-inactive" };

  const now = Date.now();
  const events = rule.steps
    .map((step) => {
      const fireAt = new Date(entry.dueDate);
      fireAt.setDate(fireAt.getDate() + step.daysOffset);
      return { step, fireAtMs: fireAt.getTime() };
    })
    .filter((x) => x.fireAtMs > now);

  if (events.length === 0) return { scheduled: 0, reason: "all-in-past" };

  await inngest.send(
    events.map(({ step, fireAtMs }) => ({
      name: "payment/dunning.fire",
      // Dedup key: mesmo entry+step nunca agenda 2 vezes no Inngest.
      id: `dunning-${entry.id}-${step.id}`,
      data: {
        entryId:        entry.id,
        stepId:         step.id,
        organizationId: entry.organizationId,
        scheduledForMs: fireAtMs,
      },
      ts: fireAtMs,
    })),
  );

  return { scheduled: events.length };
}

/**
 * Agenda 1 evento de reminder pra um PaymentApprovalRequest pendente.
 * Re-agendado automaticamente pelo próprio handler se ainda pendente após
 * o disparo (cadeia event → handler → check → re-agenda).
 *
 * Idempotência: ID derivado de (requestId, retryCount). Mesmo se chamado
 * de novo na mesma "rodada", Inngest deduplica.
 */
export async function scheduleApprovalReminder(opts: {
  requestId:       string;
  organizationId:  string;
  delayHours:      number;
  retryCount?:     number;
}) {
  const fireAtMs = Date.now() + opts.delayHours * 60 * 60 * 1000;
  const retry = opts.retryCount ?? 0;

  await inngest.send({
    name: "payment/approval.reminder",
    id:   `approval-reminder-${opts.requestId}-${retry}`,
    data: {
      requestId:      opts.requestId,
      organizationId: opts.organizationId,
      retryCount:     retry,
    },
    ts: fireAtMs,
  });

  return { scheduledFor: fireAtMs };
}
