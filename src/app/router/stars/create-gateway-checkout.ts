/**
 * Creates a real payment checkout session for Stars top-up.
 *
 * The client sends a paymentMethod ("pix" | "credit_card" | "boleto").
 * This handler silently selects the appropriate gateway:
 *   pix / boleto  → Asaas
 *   credit_card   → Stripe (or Asaas if Stripe not configured)
 */

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

// Asaas billing type per payment method
const ASAAS_BILLING: Record<string, "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED"> = {
  pix:         "PIX",
  boleto:      "BOLETO",
  credit_card: "CREDIT_CARD",
};

export const createGatewayCheckout = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Create payment checkout for Stars top-up" })
  .input(z.object({
    packageId:     z.string(),
    paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
  }))
  .output(z.object({
    provider:    z.string(),
    checkoutUrl: z.string().nullable(),
    paymentId:   z.string(),
    pixQrCode:   z.string().nullable(),   // base64 image (PIX inline)
    pixPayload:  z.string().nullable(),   // copy-paste PIX code
  }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) throw new Error("Nenhuma organização ativa.");

    // ── Load package ───────────────────────────────────────────────────────────
    const pkg = await prisma.starPackage.findUniqueOrThrow({
      where: { id: input.packageId },
    });

    // ── Auto-select gateway ────────────────────────────────────────────────────
    //  pix / boleto  → Asaas (required)
    //  credit_card   → Stripe preferred, fallback Asaas
    let gw = null;

    if (input.paymentMethod === "pix" || input.paymentMethod === "boleto") {
      gw = await prisma.paymentGatewayConfig.findFirst({
        where:   { provider: "asaas", isActive: true },
        orderBy: { isDefault: "desc" },
      });
      if (!gw) throw new Error("PIX e Boleto requerem Asaas configurado. Contate o suporte.");
    } else {
      // credit_card: try Stripe first
      gw = await prisma.paymentGatewayConfig.findFirst({
        where:   { provider: "stripe", isActive: true },
        orderBy: { isDefault: "desc" },
      });
      // fallback to Asaas
      if (!gw) {
        gw = await prisma.paymentGatewayConfig.findFirst({
          where:   { provider: "asaas", isActive: true },
          orderBy: { isDefault: "desc" },
        });
      }
      if (!gw) throw new Error("Nenhum gateway de cartão disponível. Contate o suporte.");
    }

    // ── Create StarsPayment record ─────────────────────────────────────────────
    const payment = await prisma.starsPayment.create({
      data: {
        userId:         user.id,
        organizationId: orgId,
        packageId:      pkg.id,
        starsAmount:    pkg.stars,
        amountBrl:      pkg.priceBrl,
        provider:       gw.provider,
        gatewayId:      gw.id,
        status:         "pending",
        metadata:       { paymentMethod: input.paymentMethod },
      },
    });

    const successUrl = `${ORIGIN}/settings/stars?payment=success&pid=${payment.id}`;
    const cancelUrl  = `${ORIGIN}/settings/stars?payment=cancelled`;

    // ─────────────────────────────────────────────────────────────────────────
    // STRIPE  (credit_card)
    // ─────────────────────────────────────────────────────────────────────────
    if (gw.provider === "stripe") {
      const stripe = new Stripe(gw.secretKey, { apiVersion: "2026-03-25.dahlia" });

      const stripeSession = await stripe.checkout.sessions.create({
        mode:           "payment",
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency:     "brl",
            unit_amount:  Math.round(Number(pkg.priceBrl) * 100),
            product_data: {
              name:        `${pkg.stars} Stars — ${pkg.label}`,
              description: "NASA.ex Platform Credits",
            },
          },
          quantity: 1,
        }],
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:   cancelUrl,
        metadata: {
          starsPaymentId: payment.id,
          packageId:      pkg.id,
          organizationId: orgId,
          stars:          String(pkg.stars),
        },
        payment_method_types: ["card"],
        locale: "pt-BR",
      });

      await prisma.starsPayment.update({
        where: { id: payment.id },
        data:  { externalId: stripeSession.id },
      });

      return {
        provider:    "stripe",
        checkoutUrl: stripeSession.url!,
        paymentId:   payment.id,
        pixQrCode:   null,
        pixPayload:  null,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ASAAS  (pix | boleto | credit_card fallback)
    // ─────────────────────────────────────────────────────────────────────────
    if (gw.provider === "asaas") {
      const env         = gw.environment as AsaasEnv;
      const billingType = ASAAS_BILLING[input.paymentMethod] ?? "UNDEFINED";

      // 1. Find or create Asaas customer
      const customer = await findOrCreateCustomer(
        gw.secretKey, env,
        user.email,
        user.name ?? user.email,
      );

      // 2. Create charge with the requested billing type
      const charge = await createCharge(gw.secretKey, env, {
        customerId:         customer.id,
        billingType,
        value:              Number(pkg.priceBrl),
        dueDate:            dueDatePlus(3),
        description:        `${pkg.stars} Stars — ${pkg.label} — NASA.ex`,
        externalReference:  payment.id,
        callbackSuccessUrl: successUrl,
      });

      await prisma.starsPayment.update({
        where: { id: payment.id },
        data:  { externalId: charge.id, metadata: { asaasCustomerId: customer.id, paymentMethod: input.paymentMethod } },
      });

      // 3. For PIX: fetch QR code inline for best UX
      let pixQrCode: string | null = null;
      let pixPayload: string | null = null;

      if (input.paymentMethod === "pix") {
        try {
          const qr  = await getPixQrCode(gw.secretKey, env, charge.id);
          pixQrCode  = qr.encodedImage;
          pixPayload = qr.payload;
        } catch {
          // QR fallback — client will use invoiceUrl
        }
      }

      return {
        provider:    "asaas",
        checkoutUrl: charge.invoiceUrl ?? null,
        paymentId:   payment.id,
        pixQrCode,
        pixPayload,
      };
    }

    throw new Error(`Provider não suportado: ${gw.provider}`);
  });
