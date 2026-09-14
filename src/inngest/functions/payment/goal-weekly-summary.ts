/**
 * Cron: payment-goal-weekly-summary
 *
 * Segunda-feira às 11:00 UTC (08:00 em Brasília). Manda o retrato do mês
 * corrente para quem acompanha o financeiro: quanto da meta já entrou, quanto
 * ainda há para pagar e como fica o caixa se tudo se confirmar.
 */

import { inngest } from "@/inngest/client";
import { runGoalWeeklySummary } from "@/features/payment/server/goals/run-alert-checks";

export const paymentGoalWeeklySummary = inngest.createFunction(
  { id: "payment-goal-weekly-summary", retries: 1 },
  { cron: "0 11 * * 1" },
  async ({ step, logger }) => {
    const result = await step.run("send-summary", () => runGoalWeeklySummary());
    logger.info("[payment-goal-weekly-summary] concluído", result);
    return result;
  },
);
