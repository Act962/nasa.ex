/**
 * Webhook oficial Meta Cloud API (WhatsApp). A lógica vive em `./handle`
 * (agnóstica de framework), compartilhada com a rota Fastify do apps/api. Aqui
 * só adapta Next ↔ handler: GET (handshake → text/plain challenge) e POST
 * (corpo CRU — o HMAC depende do byte-exato; JSON.parse + re-stringify quebra).
 *
 * Contrato Meta completo documentado em `docs/whatsapp-oficial-overview.md`.
 */
import { type NextRequest, NextResponse } from "next/server";
import {
  handleMetaOfficialVerify,
  handleMetaOfficialEvent,
} from "./handle";

// ── GET: verify handshake ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const { status, body, text } = await handleMetaOfficialVerify({
    mode: searchParams.get("hub.mode"),
    verifyToken: searchParams.get("hub.verify_token"),
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

// ── POST: eventos ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // O HMAC depende do byte-exato — ler RAW body antes de qualquer parse.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (error) {
    console.error("[webhook:official:POST] body_read_failed", error);
    return NextResponse.json(
      { ok: false, reason: "body_read_failed" },
      { status: 400 },
    );
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const { status, body, text } = await handleMetaOfficialEvent(
    rawBody,
    signatureHeader,
  );
  if (text) {
    return new NextResponse(String(body), {
      status,
      headers: { "content-type": "text/plain" },
    });
  }
  return NextResponse.json(body, { status });
}
