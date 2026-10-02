import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { computeAiCreditsOverview } from "@/features/ai-credits/lib/compute-ai-credits";
import { createAiCreditEntry, deleteAiCreditEntry } from "@/features/ai-credits/lib/ai-credit-entries";
import { aiCreditEntryInputSchema } from "@/features/ai-credits/lib/ai-credit-entry-schema";

/** Consumo e saldo informado da chave de IA própria da empresa, em Satélites (spec 0055, RF-9). */

const getOrganizationAiCredits = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => computeAiCreditsOverview({ organizationId: context.org.id }));

const addOrganizationAiCreditEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(aiCreditEntryInputSchema)
  .handler(async ({ input, context }) =>
    createAiCreditEntry({ organizationId: context.org.id, createdById: context.user.id, entry: input }),
  );

const removeOrganizationAiCreditEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => deleteAiCreditEntry({ organizationId: context.org.id, entryId: input.id }));

export const organizationAiCreditsRouter = {
  overview: getOrganizationAiCredits,
  addEntry: addOrganizationAiCreditEntry,
  removeEntry: removeOrganizationAiCreditEntry,
};
