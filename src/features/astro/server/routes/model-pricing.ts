import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import {
  canManageAstroModelPricing,
  getAstroModelPricingSettings,
  listCatalogModelIds,
  saveAstroModelPricingSettings,
} from "@/features/ai-credits/lib/model-pricing-settings";

/** Margem e modelos liberados na chave da plataforma (spec 0055, RF-12): admin do sistema ou super usuário. */

const MAX_MARKUP_PERCENT = 1000;

export const getAstroModelPricing = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/astro/model-pricing", summary: "ASTRO model pricing settings" })
  .handler(async ({ context }) => {
    const [settings, canManage] = await Promise.all([
      getAstroModelPricingSettings(),
      canManageAstroModelPricing(context.user.id),
    ]);
    return { ...settings, catalogModelIds: listCatalogModelIds(), canManage };
  });

export const setAstroModelPricing = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/astro/model-pricing", summary: "Update ASTRO model pricing settings" })
  .input(
    z.object({
      markupPercent: z.number().int().min(0).max(MAX_MARKUP_PERCENT),
      platformModelIds: z.array(z.string().max(80)).min(1).max(50),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageAstroModelPricing(context.user.id))) {
      throw errors.FORBIDDEN({ message: "Só o admin do sistema configura o preço dos modelos." });
    }
    await saveAstroModelPricingSettings({ ...input, updatedById: context.user.id });
    return getAstroModelPricingSettings();
  });
