import { inngest } from "@/inngest/client";
import { runExpensesDueTodayDetection } from "@/features/alerts/lib/detectors/expenses-due-today";

// A lógica mora em `features/alerts/lib/detectors/expenses-due-today.ts` (testável por org).
export const detectExpensesDueToday = inngest.createFunction(
  { id: "detect-expenses-due-today", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 8,15 * * *" },
  async ({ step }) => runExpensesDueTodayDetection(step),
);
