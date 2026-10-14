// Lembrete das aprovações paradas da venda guiada (spec 0104, CB-3): a cada 2h em horário comercial.
import { inngest } from "@/inngest/client";
import { remindStalledApprovals } from "@/features/nerp-catalog/lib/approvals/order-approvals";

export const remindSalesApprovalsCron = inngest.createFunction(
  { id: "nerp-catalog-remind-sales-approvals", retries: 1 },
  { cron: "*/30 * * * *" },
  async ({ step }) => step.run("remind", () => remindStalledApprovals()),
);
