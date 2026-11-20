import { NextResponse, type NextRequest } from "next/server";
import { channelLookup } from "@/modules/social";
import { processInstagramAppWebhook } from "@/features/comments/server/instagram-app-webhook";
import { clientIpFromHeaders, takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Webhook único do Instagram para contas conectadas pelo passo a passo: uma URL atende todas
 * as contas do mesmo app da Meta. A URL antiga, uma por conexão (`[token]`), segue valendo.
 */

// A verificação decifra as credenciais de todas as contas manuais; a Meta só chama ao salvar o webhook.
const VERIFY_RATE_LIMIT = { max: 10, windowMs: 60_000 };

export async function GET(request: NextRequest) {
  if (!takeRateLimit("instagram-webhook-verify", clientIpFromHeaders(request.headers), VERIFY_RATE_LIMIT).allowed) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    searchParams.get("hub.mode") !== "subscribe" ||
    !verifyToken ||
    !challenge ||
    !(await channelLookup.hasManualVerifyToken("INSTAGRAM", verifyToken))
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  // Raw body: reparsear e re-serializar muda bytes e quebra o HMAC.
  const outcome = await processInstagramAppWebhook({
    rawBody: await request.text(),
    signatureHeader: request.headers.get("x-hub-signature-256"),
  });
  if (outcome === "invalid_json") return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  // 200 também para conta sem conexão ou com chave errada: a Meta não deve reentregar nem desligar a URL do app.
  return NextResponse.json({ ok: true }, { status: 200 });
}
