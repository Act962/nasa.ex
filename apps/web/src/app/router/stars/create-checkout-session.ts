import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { STRIPE_PRICE_IDS } from "@/lib/stripe";
import { z } from "zod";

// Restrito a topup. Subscriptions de plano vivem no fluxo do better-auth
// (`authClient.subscription.upgrade()` / `billingPortal()`) — criar sub aqui
// gerava cobrança dupla em upgrades porque ignorava a sub existente.
const ItemTypeEnum = z.literal("topup");

export const createCheckoutSession = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemType: ItemTypeEnum,
      /** Para topups: pkg_100 | pkg_500 | pkg_1000 */
      itemSlug: z.string(),
      cancelPath: z.string().optional(),
    }),
  )
  .output(
    z.object({
      url: z.string(),
      sessionId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const topupPrices = STRIPE_PRICE_IDS.topups as Record<string, string>;
    const priceId = topupPrices[input.itemSlug];
    if (!priceId) throw new Error(`Pacote inválido: ${input.itemSlug}`);

    return {
      url: `/api/stripe/checkout?priceId=${priceId}&mode=payment&itemType=topup&itemSlug=${input.itemSlug}`,
      sessionId: "",
    };
  });
