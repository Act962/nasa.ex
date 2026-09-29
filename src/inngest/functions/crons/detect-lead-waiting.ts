import { inngest } from "@/inngest/client";
import { runLeadWaitingDetection } from "@/features/alerts/lib/detectors/lead-waiting";

// A lógica mora em `features/alerts/lib/detectors/lead-waiting.ts` (testável por org).
export const detectLeadWaiting = inngest.createFunction(
  { id: "detect-lead-waiting", retries: 1 },
  { cron: "*/2 * * * *" },
  async ({ step }) => runLeadWaitingDetection(step),
);
