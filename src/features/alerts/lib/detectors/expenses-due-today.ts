/**
 * Cron: detect-expenses-due-today (spec 0029, RF-5)
 *
 * Às 08:00 e às 15:00 (São Paulo), avisa as contas a pagar que vencem hoje e
 * ainda não foram pagas. Paga antes das 15:00, não aparece de novo (CB-5).
 *
 * Vencimento é dia de calendário, gravado ao meio-dia UTC (ver
 * `features/payment/lib/dates.ts`). "Hoje" é a data de São Paulo aplicada ao
 * dia UTC — cobre também os registros antigos gravados à meia-noite UTC.
 */

import type { GetStepTools } from "inngest";
import type { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

/** Não existe fuso por organização ainda; o financeiro inteiro usa este. */
const BUSINESS_TIMEZONE = "America/Sao_Paulo";
const BATCH_LIMIT = 300;

function todayCalendarRange(): { dayKey: string; start: Date; end: Date } {
  const dayKey = new Date().toLocaleDateString("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
  });
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dayKey, start, end };
}

/** Escopo opcional: só esta org (bateria de QA). O cron roda sem escopo. */
export interface DetectionScope {
  organizationId?: string;
}

export async function runExpensesDueTodayDetection(
  step: Pick<GetStepTools<typeof inngest>, "run">,
  scope: DetectionScope = {},
) {
  const rules = await step.run("fetch-rules", () =>
    prisma.alertRule.findMany({
      where: {
        eventType: "payment.expense_due_today",
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
      select: { id: true, organizationId: true },
    }),
  );
  if (rules.length === 0) return { rulesScanned: 0, dispatched: 0 };

  const { dayKey, start, end } = todayCalendarRange();
  const hour = new Date().toLocaleString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  });
  // Cada janela (08h, 15h) alerta uma vez; a outra janela pode alertar de novo.
  const slot = `${dayKey}:${hour}`;

  const organizationIds = scope.organizationId
    ? [scope.organizationId]
    : rules.some((rule) => rule.organizationId === null)
      ? undefined
      : rules.map((rule) => rule.organizationId as string);

  const dueEntries = await step.run("fetch-due-entries", () =>
    prisma.paymentEntry.findMany({
      where: {
        type: "PAYABLE",
        // O status decide: parcial pode ter `paidAt` e ainda dever o resto.
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        dueDate: { gte: start, lt: end },
        ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: BATCH_LIMIT,
      select: {
        id: true,
        organizationId: true,
        description: true,
        amount: true,
        paidAmount: true,
      },
    }),
  );

  const dispatched = await step.run("dispatch", async () => {
    let total = 0;
    for (const entry of dueEntries) {
      const result = await dispatchAlert("payment.expense_due_today", {
        entryId: entry.id,
        entryTitle: entry.description,
        // Valor em aberto, em reais: o que falta pagar, não o total.
        amount: Math.max(0, entry.amount - entry.paidAmount) / 100,
        slot,
        actionUrl: "/payment",
        orgId: entry.organizationId,
      });
      total += result.dispatchedCount;
    }
    return total;
  });

  return { rulesScanned: rules.length, entries: dueEntries.length, dispatched };
}
