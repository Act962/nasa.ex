/**
 * Cron: payment-goal-daily-check
 *
 * Roda às 11:00 UTC (08:00 em Brasília) e resolve os dois alertas que dependem
 * do agregado do mês: risco de furar a reserva e meta batida. A decisão mora em
 * `runGoalDailyCheck` — aqui fica só o agendamento.
 *
 * Custo zero para organização sem meta cadastrada: a varredura parte de
 * `PaymentGoalConfig`, que só existe depois que alguém configurou.
 */

import { inngest } from "@/inngest/client";
import { runGoalDailyCheck } from "@/features/payment/server/goals/run-alert-checks";

export const paymentGoalDailyCheck = inngest.createFunction(
  { id: "payment-goal-daily-check", retries: 1 },
  { cron: "0 11 * * *" },
  async ({ step, logger }) => {
    const result = await step.run("check-goals", () => runGoalDailyCheck());
    logger.info("[payment-goal-daily-check] concluído", result);
    return result;
  },
);
