import { inngest } from "@/inngest/client";
import { fireDueLeadTriggers } from "@/features/leads/lib/triggers/fire-due-triggers";

// Gatilho do lead (spec 0038, RNF-3). A lógica mora em
// `features/leads/lib/triggers/fire-due-triggers.ts` (testável por org).
export const fireLeadTriggers = inngest.createFunction(
  { id: "fire-lead-triggers", retries: 1 },
  { cron: "*/5 * * * *" },
  async ({ step }) => step.run("fire", () => fireDueLeadTriggers()),
);
