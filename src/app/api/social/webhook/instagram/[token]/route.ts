import { NextResponse, type NextRequest } from "next/server";
import { handleInboundEvent } from "@/modules/social/application/handle-inbound-event";
import {
  channelLookup,
  createChannelGateway,
  createSocialRepositories,
  getInboundTranslator,
  socialClock,
  socialLogger,
  socialPicker,
} from "@/modules/social";

export const runtime = "nodejs";

/**
 * Webhook do Instagram, um endpoint por conexão (spec 0024 D-11).
 *
 * A URL carrega o `webhookPathToken`, então o canal — e com ele o tenant — é
 * conhecido antes de qualquer consulta. É a única porta anônima do módulo, e
 * por isso todo o resto aqui é fail-closed.
 *
 * Separado de propósito de `/api/integrations/instagram/webhook`, que cria lead
 * a partir de DM e não deve ganhar uma segunda responsabilidade (D-7).
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

  const { channel, tenant } = found;
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

  const events = translator.parse(payload).filter(
    // O id da conta no payload é conferência, não busca: se não é desta
    // conexão, não é para ser processado aqui.
    (event) => event.externalAccountId === channel.externalAccountId,
  );

  if (events.length === 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const repositories = createSocialRepositories(tenant);
  const gateway = createChannelGateway(channel);

  for (const event of events) {
    try {
      const result = await handleInboundEvent(event, {
        channel,
        automations: repositories.automations,
        inboundEvents: repositories.inboundEvents,
        runs: repositories.runs,
        contacts: repositories.contacts,
        gateway,
        ai: repositories.ai,
        clock: socialClock,
        picker: socialPicker,
        logger: socialLogger,
      });

      if (result.outcome === "FAILED" && result.authError) {
        await repositories.channels.markNeedsReconnect(channel.id, result.error);
      }
    } catch (error) {
      // Uma falha num evento não pode derrubar o lote: a Meta reentregaria
      // todos, inclusive os que já foram respondidos.
      socialLogger.error("Falha ao processar evento", {
        channelId: channel.id,
        externalEventId: event.externalEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
