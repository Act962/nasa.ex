import { inngest } from "@/inngest/client";
import { runContractsExpiringDetection } from "@/features/alerts/lib/detectors/contracts-expiring";

// A lógica mora em `features/alerts/lib/detectors/contracts-expiring.ts` (testável por org).
export const detectContractsExpiring = inngest.createFunction(
  { id: "detect-contracts-expiring", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 8 * * *" },
  async ({ step }) => runContractsExpiringDetection(step),
);
