// Cron diário: conta a receber vencida vira OVERDUE (spec 0104, RF-5). Antes disso nada gravava esse status.
import { inngest } from "@/inngest/client";
import { markOverdueReceivables } from "@/features/payment/server/entries/lead-credit-status";

export const markOverdueReceivablesCron = inngest.createFunction(
  { id: "payment-mark-overdue-receivables", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 15 0 * * *" },
  async ({ step }) => {
    const updated = await step.run("mark-overdue", () => markOverdueReceivables());
    return { updated };
  },
);
