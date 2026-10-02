import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { computeAiCreditsOverview, computePlatformUsageBreakdown } from "@/features/ai-credits/lib/compute-ai-credits";
import { createAiCreditEntry, deleteAiCreditEntry } from "@/features/ai-credits/lib/ai-credit-entries";
import { aiCreditEntryInputSchema } from "@/features/ai-credits/lib/ai-credit-entry-schema";

/** Créditos de IA da plataforma no Admin (spec 0055, RF-4 e RF-6). */

const getAiCreditsOverview = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — AI credits overview", tags: ["Admin"] })
  .handler(async () => {
    const [overview, breakdown] = await Promise.all([
      computeAiCreditsOverview({ organizationId: null }),
      computePlatformUsageBreakdown(),
    ]);
    return { ...overview, breakdown };
  });

const getAiCreditsAlertLevel = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — worst AI credit level", tags: ["Admin"] })
  .handler(async () => {
    const overview = await computeAiCreditsOverview({ organizationId: null });
    const lowProviders = overview.providers.filter((summary) => summary.level === "warning" || summary.level === "critical");
    return {
      level: lowProviders.some((summary) => summary.level === "critical") ? "critical" : lowProviders.length > 0 ? "warning" : "ok",
      providers: lowProviders.map((summary) => ({ provider: summary.provider, level: summary.level, daysLeft: summary.daysLeft, balanceUsd: summary.balanceUsd })),
    };
  });

const addAiCreditEntry = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — add AI credit entry", tags: ["Admin"] })
  .input(aiCreditEntryInputSchema)
  .handler(async ({ input, context }) =>
    createAiCreditEntry({ organizationId: null, createdById: context.user.id, entry: input }),
  );

const removeAiCreditEntry = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — remove AI credit entry", tags: ["Admin"] })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => deleteAiCreditEntry({ organizationId: null, entryId: input.id }));

export const adminAiCreditsRouter = {
  overview: getAiCreditsOverview,
  alertLevel: getAiCreditsAlertLevel,
  addEntry: addAiCreditEntry,
  removeEntry: removeAiCreditEntry,
};
