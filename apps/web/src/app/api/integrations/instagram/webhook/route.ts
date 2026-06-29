/**
 * Webhook do Instagram DM. A lógica vive em `./handle` (agnóstica de framework),
 * compartilhada com a rota Fastify do apps/api. Aqui só adapta Next ↔ handler.
 */
import { type NextRequest, NextResponse } from "next/server";
import { handleInstagramVerify, handleInstagramEvent } from "./handle";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const { status, body, text } = await handleInstagramVerify({
    mode: searchParams.get("hub.mode"),
    token: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge"),
  });
  if (text) {
    return new NextResponse(String(body), {
      status,
      headers: { "content-type": "text/plain" },
    });
  }
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const { status, body } = await handleInstagramEvent(rawBody);
  return NextResponse.json(body, { status });
}
