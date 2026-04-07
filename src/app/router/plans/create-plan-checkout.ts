import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import Stripe from "stripe";
import {
  findOrCreateCustomer,
  createCharge,
  getPixQrCode,
  dueDatePlus,
  type AsaasEnv,
} from "@/lib/asaas";

const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const ASAAS_BILLING: Record<string, "PIX" | "BOLETO" | "CREDIT_CARD"> = {
  pix:         "PIX",
  boleto:      "BOLETO",
  credit_card: "CREDIT_CARD",
};

export const createPlanCheckout = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Create gateway checkout for a plan subscription" })
  .input(z.object({
    planId:        z.string(),
    paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
  }))
  .output(z.object({
    provider:    z.string(),
    checkoutUrl: z.string().nullable(),
    paymentId:   z.string(),
    pixQrCode:   z.string().nullable(),
    pixPayload:  z.string().nullable(),
  }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) throw new Error("Nenhuma organização ativa.");

    const plan = await prisma.plan.findUniqueOrThrow({
      where:  { id: input.planId },
      select: { id: true, slug: true, name: true, priceMonthly: true, ctaGatewayId: true },
    });

    // ── Auto-select gateway ───────────────────────────────────────────────────
    let gw = null;

    if (input.paymentMethod === "pix" || input.paymentMethod === "boleto") {
      gw = await prisma.paymentGatewayConfig.findFirst({
        where:   { provider: "asaas", isActive: true },
        orderBy: { isDefault: "desc" },
      });
      if (!gw) throw new Error("PIX e Boleto requerem Asaas configurado. Contate o suporte.");
    } else {
      // credit_card: honour ctaGatewayId first, then Stripe, then Asaas
      if (plan.ctaGatewayId) {
        gw = await prisma.paymentGatewayConfig.findFirst({
          where: { id: plan.ctaGatewayId, isActive: true },
        });
      }
      if (!gw) {
        gw = await prisma.paymentGatewayConfig.findFirst({
          where:   { provider: "stripe", isActive: true },
          orderBy: { isDefault: "desc" },
        });
      }
      if (!gw) {
        gw = await prisma.paymentGatewayConfig.findFirst({
          where:   { provider: "asaas", isActive: true },
          orderBy: { isDefault: "desc" },
        });
      }
      if (!gw) throw new Error("Nenhum gateway de cartão disponível. Contate o suporte.");
    }

    const successUrl = `${ORIGIN}/settings/plan?payment=success`;
    const cancelUrl  = `${ORIGIN}/home#planos`;

    // ── STRIPE (subscription) ─────────────────────────────────────────────────
    if (gw.provider === "stripe") {
      const stripe = new Stripe(gw.secretKey, { apiVersion: "2026-03-25.dahlia" });

      const stripeSession = await stripe.checkout.sessions.create({
        mode:           "subscription",
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency:     "brl",
            unit_amount:  Math.round(Number(plan.priceMonthly) * 100),
            recurring:    { interval: "month" },
            product_data: {
              name:        `Plano ${plan.name} — NASA.ex`,
              description: `Assinatura mensal do plano ${plan.name}`,
            },
          },
          quantity: 1,
        }],
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  cancelUrl,
        metadata:    { organizationId: orgId, itemType: "plan", itemSlug: plan.slug },
        payment_method_types: ["card"],
        locale: "pt-BR",
      });

      return {
        provider:    "stripe",
        checkoutUrl: stripeSession.url!,
        paymentId:   stripeSession.id,
        pixQrCode:   null,
        pixPayload:  null,
      };
    }

    // ── ASAAS (pix | boleto | credit_card fallback) ───────────────────────────
    if (gw.provider === "asaas") {
      const env         = gw.environment as AsaasEnv;
      const billingType = ASAAS_BILLING[input.paymentMethod];

      const customer = await findOrCreateCustomer(
        gw.secretKey, env,
        user.email,
        user.name ?? user.email,
      );

      const charge = await createCharge(gw.secretKey, env, {
        customerId:         customer.id,
        billingType,
        value:              Number(plan.priceMonthly),
        dueDate:            dueDatePlus(3),
        description:        `Plano ${plan.name} — NASA.ex`,
        externalReference:  `plan_${plan.id}_${orgId}`,
        callbackSuccessUrl: successUrl,
      });

      let pixQrCode:  string | null = null;
      let pixPayload: string | null = null;

      if (input.paymentMethod === "pix") {
        try {
          const qr   = await getPixQrCode(gw.secretKey, env, charge.id);
          pixQrCode  = qr.encodedImage;
          pixPayload = qr.payload;
        } catch { /* fallback to invoiceUrl */ }
      }

      return {
        provider:    "asaas",
        checkoutUrl: charge.invoiceUrl ?? null,
        paymentId:   charge.id,
        pixQrCode,
        pixPayload,
      };
    }

    throw new Error(`Provider não suportado: ${gw.provider}`);
  });
