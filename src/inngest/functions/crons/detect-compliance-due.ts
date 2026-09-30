import { inngest } from "@/inngest/client";
import { runComplianceDueDetection } from "@/features/alerts/lib/detectors/compliance-due";

// A lógica mora em `features/alerts/lib/detectors/compliance-due.ts` (testável por org).
export const detectComplianceDue = inngest.createFunction(
  { id: "detect-compliance-due", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 8 * * *" },
  async ({ step }) => runComplianceDueDetection(step),
);
