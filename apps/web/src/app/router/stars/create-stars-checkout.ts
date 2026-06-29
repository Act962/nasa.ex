/**
 * Cria uma Stripe Checkout Session para recarga de Stars.
 *
 * Preço uniforme R$/★ (RouterPaymentSettings). Aceita qualquer quantidade
 * (presets ou customizada) acima do mínimo. PIX/Boleto ficam para depois —
 * este fluxo é exclusivamente cartão via Stripe.
 *
 * O crédito das Stars acontece de forma assíncrona no webhook dedicado
 * (`/api/stars/webhook`) após confirmação do pagamento.
 */

import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getStarPriceBrl, starsToBrlCents } from "@/features/nasa-route/lib/pricing";
import {
  getDiscountRateForTier,
  getProgramSettings,
} from "@/features/partner/lib/partner-service";
import { PartnerStatus, Prisma } from "@/generated/prisma/client";
import { MIN_TOPUP_BRL_CENTS, MAX_TOPUP_STARS } from "./get-stars-pricing";

const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const DEFAULT_RETURN = "/settings/billing";

/**
 * Sanitiza o returnPath pra evitar open-redirect. Exige um path interno
 * "limpo": começa com uma única "/", sem backslash, sem esquema e sem
 * caracteres de controle/whitespace. Caso contrário, usa o default.
 */
function safeReturnPath(returnPath?: string): string {
  if (!returnPath) return DEFAULT_RETURN;
  const ok =
    returnPath.startsWith("/") &&
    !returnPath.startsWith("//") &&
    !returnPath.includes("\\") &&
    !returnPath.includes(":") &&
    // só path/query/fragment seguros — sem espaços nem caracteres de controle
    /^\/[^\s]*$/.test(returnPath);
  return ok ? returnPath : DEFAULT_RETURN;
}

export const createStarsCheckout = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Create Stripe checkout for Stars top-up" })
  .input(
    z.object({
      stars: z.number().int().positive().max(MAX_TOPUP_STARS),
      returnPath: z.string().max(512).optional(),
    }),
  )
  .output(
    z.object({
      checkoutUrl: z.string(),
      paymentId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) throw new Error("Nenhuma organização ativa.");

    // ── Preço + validação de limites ────────────────────────────────────────
    const starPriceBrl = await getStarPriceBrl();
    if (!Number.isFinite(starPriceBrl) || starPriceBrl <= 0) {
      throw new Error("Cotação de Stars inválida. Contate o suporte.");
    }
    const minStars = Math.ceil(MIN_TOPUP_BRL_CENTS / 100 / starPriceBrl);
    if (input.stars < minStars) {
      throw new Error(
        `Quantidade mínima de ${minStars.toLocaleString("pt-BR")} ★ (R$ ${(
          MIN_TOPUP_BRL_CENTS / 100
        ).toFixed(2)}).`,
      );
    }
    if (input.stars > MAX_TOPUP_STARS) {
      throw new Error(
        `Quantidade máxima por compra: ${MAX_TOPUP_STARS.toLocaleString("pt-BR")} ★.`,
      );
    }

    const originalCents = starsToBrlCents(input.stars, starPriceBrl);

    // ── Desconto de parceiro ACTIVE (snapshot) ──────────────────────────────
    let amountBrlCents = originalCents;
    let partnerDiscountSnapshot: {
      partnerId: string;
      tier: string;
      ratePercent: number;
      originalBrl: number;
      paidBrl: number;
      savingsBrl: number;
    } | null = null;

    const partnerRow = await prisma.partner.findUnique({
      where: { userId: user.id },
    });
    if (partnerRow && partnerRow.status === PartnerStatus.ACTIVE && partnerRow.tier) {
      const settings = await getProgramSettings();
      const ratePercent = getDiscountRateForTier(partnerRow.tier, settings);
      if (ratePercent > 0) {
        amountBrlCents = Math.round(originalCents * (1 - ratePercent / 100));
        partnerDiscountSnapshot = {
          partnerId: partnerRow.id,
          tier: partnerRow.tier,
          ratePercent,
          originalBrl: originalCents / 100,
          paidBrl: amountBrlCents / 100,
          savingsBrl: (originalCents - amountBrlCents) / 100,
        };
      }
    }

    // ── Stripe do sistema (STRIPE_SECRET_KEY) ────────────────────────────────
    const stripe = getStripe();

    // ── Anti-double-charge / anti-spam ───────────────────────────────────────
    // Reaproveita um checkout pendente recente (mesmo user + mesma quantidade)
    // ainda aberto no Stripe, em vez de criar outra Session/cobrança paralela.
    const recent = await prisma.starsPayment.findFirst({
      where: {
        organizationId: orgId,
        userId: user.id,
        provider: "stripe",
        status: "pending",
        starsAmount: input.stars,
        externalId: { not: null },
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent?.externalId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          recent.externalId,
        );
        if (existing.status === "open" && existing.url) {
          return { checkoutUrl: existing.url, paymentId: recent.id };
        }
      } catch {
        // Sessão não recuperável — segue criando uma nova.
      }
    }

    // ── StarsPayment (pending) ───────────────────────────────────────────────
    const paymentMetadata: Record<string, unknown> = { source: "stars_topup" };
    if (partnerDiscountSnapshot) {
      paymentMetadata.partnerDiscount = partnerDiscountSnapshot;
    }

    const payment = await prisma.starsPayment.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        packageId: null,
        starsAmount: input.stars,
        amountBrl: amountBrlCents / 100,
        provider: "stripe",
        gatewayId: null,
        status: "pending",
        metadata: paymentMetadata as Prisma.InputJsonValue,
      },
    });

    // ── Stripe Checkout Session ──────────────────────────────────────────────
    const ret = safeReturnPath(input.returnPath);
    const sep = ret.includes("?") ? "&" : "?";
    const successUrl = `${ORIGIN}${ret}${sep}stars=success`;
    const cancelUrl = `${ORIGIN}${ret}${sep}stars=cancelled`;

    const piMetadata = {
      kind: "stars_topup",
      starsPaymentId: payment.id,
      organizationId: orgId,
    };

    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: amountBrlCents,
              product_data: {
                name: `${input.stars.toLocaleString("pt-BR")} Stars — NASA.ex`,
                description: partnerDiscountSnapshot
                  ? `Recarga de Stars — Desconto Parceiro ${partnerDiscountSnapshot.ratePercent}%`
                  : "Recarga de Stars",
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"],
        locale: "pt-BR",
        // Campo nativo de cupom no Checkout do Stripe. Aceita apenas Promotion
        // Codes ativos criados no Dashboard — validação 100 % server-side do Stripe.
        // O desconto reduz o amount_total; as Stars creditadas continuam cheias
        // (ver finalizeStarsTopUpInTx).
        allow_promotion_codes: true,
        metadata: piMetadata,
        // Propaga pro PaymentIntent pra o fallback `payment_intent.succeeded`.
        payment_intent_data: { metadata: piMetadata },
      },
      // Idempotência: protege contra retry de rede do SDK recriar uma cobrança
      // paralela pra este mesmo StarsPayment. (Double-click é barrado no client.)
      { idempotencyKey: `stars-topup:${payment.id}` },
    );

    await prisma.starsPayment.update({
      where: { id: payment.id },
      data: {
        externalId: checkout.id,
        stripePaymentIntentId:
          typeof checkout.payment_intent === "string"
            ? checkout.payment_intent
            : null,
      },
    });

    if (!checkout.url) throw new Error("Stripe não retornou URL de checkout.");
    return { checkoutUrl: checkout.url, paymentId: payment.id };
  });
