import { inngest } from "@/inngest/client";
import {
  captureNewEmailSenders,
  listOrganizationsWithEmailLeadCapture,
} from "@/features/tracking-chat/server/email/email-lead-capture";

// A cada 5 min: e-mail de remetente novo vira lead no funil escolhido (spec 0045, RF-2).
// Um step por empresa: Gmail fora do ar numa não trava as outras.
export const emailLeadCaptureCron = inngest.createFunction(
  { id: "email-lead-capture", retries: 0, concurrency: { limit: 1 } },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const organizationIds = await step.run("empresas-com-captura", () => listOrganizationsWithEmailLeadCapture());
    const results: Record<string, number> = {};
    for (const organizationId of organizationIds) {
      results[organizationId] = await step.run(`captura-${organizationId}`, async () => {
        try {
          const result = await captureNewEmailSenders(organizationId);
          return result.created;
        } catch (error) {
          console.error("[email-lead-capture] org_failed", organizationId, error);
          return 0;
        }
      });
    }
    return { results };
  },
);
