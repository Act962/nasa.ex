import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { STRIPE_PRICE_IDS } from "@/lib/stripe";
import { z } from "zod";

const ItemTypeEnum = z.enum(["plan", "topup"]);

export const createCheckoutSession = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemType: ItemTypeEnum,
      /** Para plans: earth | explore | constellation. Para topups: pkg_100 | pkg_500 | pkg_1000 */
      itemSlug: z.string(),
      cancelPath: z.string().optional(),
    })
  )
  .output(
    z.object({
      url: z.string(),
      sessionId: z.string(),
    })
  )
  .handler(async ({ input, context }) => {
    // Resolve priceId
    let priceId: string;
    let mode: "subscription" | "payment";

    if (input.itemType === "plan") {
      const planPrices = STRIPE_PRICE_IDS.plans as Record<string, string>;
      priceId = planPrices[input.itemSlug];
      if (!priceId) throw new Error(`Plano inválido: ${input.itemSlug}`);
      mode = "subscription";
    } else {
      const topupPrices = STRIPE_PRICE_IDS.topups as Record<string, string>;
      priceId = topupPrices[input.itemSlug];
      if (!priceId) throw new Error(`Pacote inválido: ${input.itemSlug}`);
      mode = "payment";
    }

    // Delegamos ao route handler da API para usar o auth completo do Next.js
    // O ORPC handler não tem acesso ao origin, então retornamos os dados
    // para o cliente chamar /api/stripe/checkout diretamente.
    // Este handler serve apenas para validar e resolver o priceId.
    return {
      url: `/api/stripe/checkout?priceId=${priceId}&mode=${mode}&itemType=${input.itemType}&itemSlug=${input.itemSlug}`,
      sessionId: "",
    };
  });
