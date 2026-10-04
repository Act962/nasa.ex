import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processMetaCommentsWebhook } from "@/features/comments/server/meta-webhook";

export const runtime = "nodejs";

/**
 * Webhook único do Comments para contas conectadas pelo login da Meta (spec 0061, RF-5).
 * Configurado uma vez no app da Meta da plataforma; o canal é achado pelo `entry.id`.
 * Fail-closed: sem META_APP_SECRET ou META_WEBHOOK_VERIFY_TOKEN, recusa tudo.
 */

function isSameSecret(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const expectedVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    !expectedVerifyToken ||
    searchParams.get("hub.mode") !== "subscribe" ||
    !verifyToken ||
    !challenge ||
    !isSameSecret(verifyToken, expectedVerifyToken)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  // Raw body: reparsear e re-serializar muda bytes e quebra o HMAC.
  const outcome = await processMetaCommentsWebhook({
    rawBody: await request.text(),
    signatureHeader: request.headers.get("x-hub-signature-256"),
  });
  if (outcome === "invalid_signature") return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  if (outcome === "invalid_json") return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  // 200 sempre que a assinatura vale: conta sem canal não deve ser reentregue (CB-7).
  return NextResponse.json({ ok: true }, { status: 200 });
}
