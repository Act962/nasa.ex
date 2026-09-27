import { inngest } from "@/inngest/client";
import { runAiTokenUsageDetection } from "@/features/alerts/lib/ai-token-alerts";

// Consumo alto de tokens de IA no dia (spec 0037, RF-4). A lógica mora em
// `features/alerts/lib/ai-token-alerts.ts` (testável por org).
export const detectAiTokenUsage = inngest.createFunction(
  { id: "detect-ai-token-usage", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 5 * * * *" },
  async ({ step }) => step.run("detect", () => runAiTokenUsageDetection()),
);
