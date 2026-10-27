import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  trafegoCampaignTypeSchema,
  trafegoObjectiveSchema,
  trafegoPlatformSchema,
} from "@/features/trafego/schema/trafego-schemas";
import { MAX_AD_BUDGET_BRL_CENTS } from "@/features/trafego/lib/pricing-tiers";
import {
  CAMPAIGN_TYPES_BY_PLATFORM,
  OBJECTIVES_BY_PLATFORM,
} from "@/features/trafego/lib/catalog-labels";
import { createManualTrafegoOrder } from "@/features/trafego/server/lib/create-manual-order";

const centsSchema = z.number().int().min(0).max(MAX_AD_BUDGET_BRL_CENTS);

/** Pedido de cliente que pagou fora da landing (spec 0116). */
export const createManualTrafegoOrderProcedure = base
  .use(requireAdminMiddleware)
  .input(
    z
      .object({
        organizationId: z.string().min(1),
        platform: trafegoPlatformSchema,
        campaignType: trafegoCampaignTypeSchema,
        objective: trafegoObjectiveSchema,
        paymentMethod: z.enum(["CARD", "PIX"]),
        adBudgetBrlCents: centsSchema.min(100),
        serviceFeeBrlCents: centsSchema,
        setupFeeBrlCents: centsSchema,
        durationDays: z.number().int().min(1).max(365),
        maxCreatives: z.number().int().min(1).max(50),
        maxCopies: z.number().int().min(1).max(50),
        businessName: z.string().trim().max(160).optional(),
        whatsappNumber: z.string().trim().max(30).optional(),
        internalNote: z.string().trim().max(2000).optional(),
        registerFinance: z.boolean(),
      })
      .refine(
        (input) => OBJECTIVES_BY_PLATFORM[input.platform].includes(input.objective),
        { message: "Objetivo não disponível para esse canal.", path: ["objective"] },
      )
      .refine(
        (input) => CAMPAIGN_TYPES_BY_PLATFORM[input.platform].includes(input.campaignType),
        { message: "Tipo de campanha não disponível para esse canal.", path: ["campaignType"] },
      ),
  )
  .handler(async ({ input, context }) => {
    const result = await createManualTrafegoOrder(input, context.adminUser);

    if (!result.ok) {
      throw new ORPCError(
        result.reason === "organization_not_found" ? "NOT_FOUND" : "BAD_REQUEST",
        {
          message:
            result.reason === "organization_not_found"
              ? "Organização não encontrada."
              : "Essa organização não tem membros para ser dona do pedido.",
        },
      );
    }

    return { orderId: result.orderId, code: result.code };
  });
