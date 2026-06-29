/**
 * Returns available payment methods based on active gateway configurations.
 * The client never sees "Stripe" or "Asaas" — only payment methods like
 * "PIX", "Cartão de Crédito", "Boleto".
 */

import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

export const listActiveGateways = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "List available payment methods for Stars purchase" })
  .output(z.object({
    methods: z.array(z.object({
      id:          z.enum(["pix", "credit_card", "boleto"]),
      label:       z.string(),
      description: z.string(),
      isSandbox:   z.boolean(),
    })),
    // Legacy: does any gateway exist at all?
    hasGateways: z.boolean(),
  }))
  .handler(async () => {
    const rows = await prisma.paymentGatewayConfig.findMany({
      where:  { isActive: true },
      select: { provider: true, environment: true },
    });

    const hasAsaas  = rows.some((r) => r.provider === "asaas");
    const hasStripe = rows.some((r) => r.provider === "stripe");
    const isSandbox = (provider: string) =>
      rows.find((r) => r.provider === provider)?.environment === "sandbox";

    const methods: Array<{
      id: "pix" | "credit_card" | "boleto";
      label: string;
      description: string;
      isSandbox: boolean;
    }> = [];

    // PIX — only via Asaas
    if (hasAsaas) {
      methods.push({
        id:          "pix",
        label:       "PIX",
        description: "Pagamento instantâneo • Confirmação em segundos",
        isSandbox:   isSandbox("asaas"),
      });
    }

    // Credit Card — Stripe preferred, Asaas fallback
    if (hasStripe || hasAsaas) {
      const via = hasStripe ? "stripe" : "asaas";
      methods.push({
        id:          "credit_card",
        label:       "Cartão de Crédito / Débito",
        description: hasStripe
          ? "Visa, Mastercard, Amex • Aprovação imediata"
          : "Cartão via Asaas • Processamento BR",
        isSandbox: isSandbox(via),
      });
    }

    // Boleto — only via Asaas
    if (hasAsaas) {
      methods.push({
        id:          "boleto",
        label:       "Boleto Bancário",
        description: "Compensação em até 3 dias úteis",
        isSandbox:   isSandbox("asaas"),
      });
    }

    return {
      methods,
      hasGateways: rows.length > 0,
    };
  });
