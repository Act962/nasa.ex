/**
 * Configuração de preço para o modal de compra de Stars.
 *
 * Fonte única pra UI: preço unitário (R$/★), mínimo de compra e atalhos de
 * quantidade (presets). Preço uniforme — presets e quantidade customizada usam
 * o mesmo `starPriceBrl` de `RouterPaymentSettings`.
 */

import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { getStarPriceBrl } from "@/features/nasa-route/lib/pricing";

/** Valor mínimo de compra em centavos (R$5,00). */
export const MIN_TOPUP_BRL_CENTS = 500;

/** Teto de segurança por compra — evita cobranças absurdas / estouro no Stripe. */
export const MAX_TOPUP_STARS = 1_000_000;

/** Atalhos de quantidade exibidos no modal. */
export const STARS_PRESETS = [100, 300, 500, 1000, 2000] as const;

export const getStarsPricing = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Stars top-up pricing config" })
  .output(
    z.object({
      starPriceBrl: z.number(),
      minStars: z.number(),
      minBrlCents: z.number(),
      maxStars: z.number(),
      presets: z.array(z.number()),
    }),
  )
  .handler(async () => {
    const starPriceBrl = await getStarPriceBrl();
    const minStars = Math.ceil(MIN_TOPUP_BRL_CENTS / 100 / starPriceBrl);
    return {
      starPriceBrl,
      minStars,
      minBrlCents: MIN_TOPUP_BRL_CENTS,
      maxStars: MAX_TOPUP_STARS,
      presets: [...STARS_PRESETS],
    };
  });
