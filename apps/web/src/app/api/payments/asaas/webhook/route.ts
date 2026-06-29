/**
 * POST /api/payments/asaas/webhook — crédito de Stars via Asaas. A lógica vive
 * em `./handle` (agnóstica de framework), compartilhada com a rota Fastify do
 * apps/api. A Asaas não assina o corpo; passamos o corpo cru e o handler parseia.
 */
import { NextRequest, NextResponse } from "next/server";
import { handleAsaasWebhook } from "./handle";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const { status, body } = await handleAsaasWebhook(rawBody);
  return NextResponse.json(body, { status });
}

export const runtime = "nodejs";
