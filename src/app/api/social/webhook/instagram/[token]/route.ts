import { NextResponse, type NextRequest } from "next/server";
import { channelLookup, getInboundTranslator, socialLogger } from "@/modules/social";
import { dispatchInstagramEventsByAccount } from "@/features/comments/server/instagram-event-dispatch";
import { acceptsChannelSignedWithOwnSecret } from "@/features/comments/server/instagram-app-webhook";

export const runtime = "nodejs";

/**
 * Webhook do Instagram, um endpoint por conexão (spec 0024 D-11). Mantido para quem já o
 * configurou; contas novas usam a URL única `/api/social/webhook/instagram`.
 *
 * O token da URL diz qual chave confere a assinatura; os eventos vão para a conta do `entry.id`.
 *
 * Separado de propósito de `/api/integrations/instagram/webhook` (D-7). Depois da
 * automação do Comments, o comentário ou a DM vira conversa no Chat (spec 0062).
 */

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const found = await channelLookup.findByWebhookPathToken("INSTAGRAM", token);
  if (!found || found.channel.credentials.verifyToken !== verifyToken) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  // Raw body: reparsear e re-serializar muda bytes e quebra o HMAC.
  const rawBody = await request.text();

  const found = await channelLookup.findByWebhookPathToken("INSTAGRAM", token);
  if (!found) {
    // 200 de propósito: se a conexão foi removida, a Meta não deve ficar
    // reentregando para sempre.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { channel } = found;
  const translator = getInboundTranslator("INSTAGRAM");

  const isSignatureValid = translator.verifySignature({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
    appSecret: channel.credentials.appSecret,
  });

  if (!isSignatureValid) {
    socialLogger.warn("Assinatura inválida no webhook", { channelId: channel.id });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // A Meta manda todas as contas do app para a URL salva nele: as outras contas do mesmo app
  // também são atendidas aqui, cada uma conferida com a própria chave (spec 0024, D-11 revista).
  await dispatchInstagramEventsByAccount(
    translator.parse(payload),
    acceptsChannelSignedWithOwnSecret({ rawBody, signatureHeader: request.headers.get("x-hub-signature-256") }),
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
