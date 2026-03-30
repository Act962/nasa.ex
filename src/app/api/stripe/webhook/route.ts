/**
 * POST /api/stripe/webhook
 *
 * Recebe eventos do Stripe e atualiza o banco de dados da plataforma NASA.
 *
 * Configurar no Stripe Dashboard:
 *   Endpoint URL: https://seudominio.com/api/stripe/webhook
 *   Eventos a ouvir:
 *     - checkout.session.completed
 *     - invoice.payment_succeeded   (renovação de plano)
 *     - customer.subscription.deleted (cancelamento)
 */

import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { purchaseTopUp, runMonthlyCycle } from "@/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const payload   = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  // ── Validate signature ─────────────────────────────────────────────────────
  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    console.error("[stripe/webhook] signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  try {
    switch (event.type) {

      // ── Checkout concluído ───────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const { organizationId, itemType, itemSlug } = session.metadata ?? {};
        if (!organizationId) break;

        if (itemType === "plan") {
          // Busca o plano pelo slug e associa à org
          const plan = await prisma.plan.findUnique({ where: { slug: itemSlug } });
          if (plan) {
            const hasNoStars = (await prisma.organization.findUnique({
              where: { id: organizationId },
              select: { starsBalance: true, starsCycleStart: true },
            }))?.starsCycleStart === null;

            await prisma.organization.update({
              where: { id: organizationId },
              data: {
                planId: plan.id,
                // Iniciar ciclo se for a primeira vez
                ...(hasNoStars && { starsCycleStart: new Date() }),
              },
            });

            // Creditar stars do plano se for primeiro ciclo
            if (hasNoStars) {
              await runMonthlyCycle(organizationId);
            }
          }
        } else if (itemType === "topup") {
          // itemSlug é o packageId
          await purchaseTopUp(organizationId, itemSlug);
        }
        break;
      }

      // ── Renovação de assinatura (nova fatura paga) ───────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        // TODO: mapear customerId → organizationId após salvar stripeCustomerId na org
        // Por ora, apenas loga
        console.log("[stripe/webhook] invoice paid for customer:", customerId);
        break;
      }

      // ── Cancelamento de assinatura ───────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        // TODO: remover plano da org ao cancelar
        console.log("[stripe/webhook] subscription cancelled for customer:", customerId);
        break;
      }

      default:
        // Ignorar eventos não tratados
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Stripe exige o body bruto — desabilita o body parser do Next.js
export const runtime = "nodejs";
