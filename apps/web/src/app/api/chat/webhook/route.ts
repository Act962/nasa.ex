/**
 * POST /api/chat/webhook?trackingId=... — webhook Uazapi (inbound WhatsApp
 * principal). A lógica vive em `./handle` (agnóstica de framework), compartilhada
 * com a rota Fastify do apps/api. Aqui só adapta Next ↔ handler.
 */
import { type NextRequest } from "next/server";
import { handleUazapiWebhook } from "./handle";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("trackingId");
  const rawBody = await request.text();
  return handleUazapiWebhook(trackingId, rawBody);
}
