/**
 * POST /api/stars/webhook — webhook dedicado de recarga de Stars via Stripe
 * (secret `STRIPE_STARS_WEBHOOK_SECRET`). A lógica vive em `./handle`
 * (agnóstica de framework), compartilhada com a rota Fastify do apps/api.
 * Aqui só adapta Next ↔ handler: lê o corpo CRU (Stripe exige body bruto).
 */
import { NextRequest, NextResponse } from "next/server";
import { handleStarsWebhook } from "./handle";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const { status, body } = await handleStarsWebhook(rawBody, signature);
  return NextResponse.json(body, { status });
}

export const runtime = "nodejs";
