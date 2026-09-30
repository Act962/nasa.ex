import { z } from "zod";
import { getOrCreateTaxProfile } from "@/features/accounting/server/profile/tax-profile";
import { loadAccountingOverview } from "@/features/accounting/server/overview/load-accounting-overview";
import { accountingReadProcedure } from "./procedures";

export const getAccountingOverview = accountingReadProcedure
  .route({ method: "GET", summary: "Visão geral da aba Contábil", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      regime: z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]),
      isOnboarded: z.boolean(),
      scoreBps: z.number(),
      blockingCount: z.number(),
      pendingItemsCount: z.number(),
      overdueObligationsCount: z.number(),
      nextObligations: z.array(
        z.object({ id: z.string(), kind: z.string(), label: z.string(), period: z.string(), dueDate: z.date(), status: z.string() }),
      ),
      lastMonth: z.object({
        period: z.string(),
        draftCount: z.number(),
        totalAmountCents: z.number(),
        hasAssessment: z.boolean(),
      }),
      availableCredits: z.object({ cbsCents: z.number(), ibsCents: z.number() }),
      paidWithoutInvoiceCount: z.number(),
    }),
  )
  .handler(async ({ context }) => {
    const profile = await getOrCreateTaxProfile(context.org.id);
    return loadAccountingOverview({ organizationId: context.org.id, profile });
  });
