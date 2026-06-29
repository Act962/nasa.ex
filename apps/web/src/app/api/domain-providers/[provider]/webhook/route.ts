/**
 * Webhook do registrador de domínios. A lógica vive em `./handle` (agnóstica de
 * framework), compartilhada com a rota Fastify do apps/api. Aqui só adapta
 * Next ↔ handler.
 */
import { NextRequest, NextResponse } from "next/server";
import { handleDomainProviderWebhook } from "./handle";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;
  const rawBody = await request.text();
  const { status, body } = await handleDomainProviderWebhook(provider, rawBody);
  return NextResponse.json(body, { status });
}
