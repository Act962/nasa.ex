import { inngest } from "@/inngest/client";
import { runAiTokenUsageDetection } from "@/features/alerts/lib/ai-token-alerts";
import { runAiCreditBalanceCheck } from "@/features/ai-credits/lib/run-credit-balance-check";

// Consumo alto de tokens de IA no dia (spec 0037, RF-4) e saldo de crédito
// baixando (spec 0055, RF-5). A lógica mora nas libs (testável por org).
export const detectAiTokenUsage = inngest.createFunction(
  { id: "detect-ai-token-usage", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 5 * * * *" },
  async ({ step }) => {
    const tokenUsage = await step.run("detect", () => runAiTokenUsageDetection());
    const creditBalance = await step.run("credit-balance", () => runAiCreditBalanceCheck());
    return { tokenUsage, creditBalance };
  },
);
