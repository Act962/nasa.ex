/**
 * Stripe client — NASA Platform  (lazy initialization)
 *
 * O cliente Stripe é criado sob demanda (lazy) para que a ausência de
 * STRIPE_SECRET_KEY no ambiente de desenvolvimento não quebre o boot
 * da aplicação. O erro só ocorre quando uma função de pagamento é
 * realmente chamada.
 *
 * Para ativar:
 *  1. npm install stripe  ← já feito
 *  2. Adicionar ao .env:
 *       STRIPE_SECRET_KEY=sk_live_...
 *       STRIPE_WEBHOOK_SECRET=whsec_...
 *       NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
 *  3. No Stripe Dashboard criar Products/Prices para cada plano e top-up
 *     e preencher as vars STRIPE_PRICE_* abaixo.
 */

import Stripe from "stripe";

// ─── Price IDs (preencher após criar no Stripe Dashboard) ─────────────────────

export const STRIPE_PRICE_IDS = {
  plans: {
    earth:         process.env.STRIPE_PRICE_EARTH         ?? "price_earth_placeholder",
    explore:       process.env.STRIPE_PRICE_EXPLORE       ?? "price_explore_placeholder",
    constellation: process.env.STRIPE_PRICE_CONSTELLATION ?? "price_constellation_placeholder",
  },
  topups: {
    pkg_100:  process.env.STRIPE_PRICE_TOPUP_100  ?? "price_topup100_placeholder",
    pkg_500:  process.env.STRIPE_PRICE_TOPUP_500  ?? "price_topup500_placeholder",
    pkg_1000: process.env.STRIPE_PRICE_TOPUP_1000 ?? "price_topup1000_placeholder",
  },
} as const;

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// Não instancia na carga do módulo — só quando getStripe() é chamado.

const globalForStripe = global as unknown as { _stripe: Stripe | undefined };

function getStripe(): Stripe {
  if (globalForStripe._stripe) return globalForStripe._stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY não configurada. Adicione ao .env para habilitar pagamentos."
    );
  }

  const client = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });

  if (process.env.NODE_ENV !== "production") {
    globalForStripe._stripe = client;
  }

  return client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface CreateCheckoutParams {
  priceId: string;
  mode: "subscription" | "payment";
  successUrl: string;
  cancelUrl: string;
  organizationId: string;
  itemType: "plan" | "topup";
  itemSlug: string;
  customerId?: string;
  customerEmail?: string;
}

/**
 * Cria uma Stripe Checkout Session e retorna a URL de redirecionamento.
 * Lança erro se STRIPE_SECRET_KEY não estiver configurada.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: params.mode,
    customer: params.customerId,
    customer_email: params.customerId ? undefined : params.customerEmail,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      organizationId: params.organizationId,
      itemType: params.itemType,
      itemSlug: params.itemSlug,
    },
    payment_method_types: ["card"],
    locale: "pt-BR",
  });

  if (!session.url) throw new Error("Stripe não retornou URL de checkout.");
  return { url: session.url, sessionId: session.id };
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export type StripeWebhookEvent = Stripe.Event;

/**
 * Valida a assinatura e constrói o evento do webhook.
 * Usar no route handler /api/stripe/webhook.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): StripeWebhookEvent {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET não configurada.");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
