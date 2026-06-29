/**
 * @deprecated Não use mais. Subscriptions de plano agora vivem 100% no fluxo
 * do better-auth (`authClient.subscription.upgrade()` / `billingPortal()`).
 *
 * Este procedure ficou desabilitado porque criava uma sub Stripe direto
 * (`stripe.checkout.sessions.create({ mode: "subscription" })`) sem checar/
 * cancelar a sub anterior, gerando cobrança dupla em upgrades.
 *
 * Fluxo correto: `src/app/(platform)/subscription/confirm/page.tsx` →
 * `authClient.subscription.upgrade()` (que internamente faz
 * `stripe.subscriptions.update()` quando já existe sub ativa).
 */
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

export const createPlanCheckout = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "[DEPRECATED] Subscriptions migraram pro better-auth",
  })
  .input(
    z.object({
      planId: z.string(),
      paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
    }),
  )
  .output(
    z.object({
      provider: z.string(),
      checkoutUrl: z.string().nullable(),
      paymentId: z.string(),
      pixQrCode: z.string().nullable(),
      pixPayload: z.string().nullable(),
    }),
  )
  .handler(async () => {
    throw new Error(
      "Endpoint removido: assinaturas agora usam o fluxo do better-auth. Use /subscription/confirm ou authClient.subscription.upgrade().",
    );
  });
