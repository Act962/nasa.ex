/**
 * POST /api/stripe/webhook — endpoint dedicado (NASA Route/cursos + topup
 * legacy de Stars + refund/dispute). A lógica vive em `./handle` (agnóstica de
 * framework), compartilhada com a rota Fastify do apps/api. Aqui só adapta
 * Next ↔ handler: lê o corpo CRU (Stripe exige body bruto pra assinatura).
 */
import { NextRequest, NextResponse } from "next/server";
import { handleStripeCourseWebhook } from "./handle";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const { status, body } = await handleStripeCourseWebhook(rawBody, signature);
  return NextResponse.json(body, { status });
}

export const runtime = "nodejs";
