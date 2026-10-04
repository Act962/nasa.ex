import "server-only";
import { channelLookup, getInboundTranslator, socialLogger } from "@/modules/social";
import { processChannelEvents } from "@/modules/social/process-channel-events";
import { ingestInstagramEventToChat } from "@/features/tracking-chat/server/instagram/ingest-instagram-event";
import type { InboundEvent } from "@/modules/social/domain/types";

/**
 * Eventos do Instagram que chegam pelo app da Meta da plataforma (spec 0061, RF-5).
 * Chamado pelo webhook dedicado e pelo webhook antigo do Instagram — a Meta aceita uma URL
 * por objeto, então qualquer uma das duas que estiver configurada no app atende o Comments.
 */
export async function processMetaCommentsWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<"processed" | "invalid_signature" | "invalid_json"> {
  const translator = getInboundTranslator("INSTAGRAM");
  const isSignatureValid = translator.verifySignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    appSecret: process.env.META_APP_SECRET ?? "",
  });
  if (!isSignatureValid) return "invalid_signature";

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return "invalid_json";
  }

  const eventsByAccount = new Map<string, InboundEvent[]>();
  for (const event of translator.parse(payload)) {
    eventsByAccount.set(event.externalAccountId, [...(eventsByAccount.get(event.externalAccountId) ?? []), event]);
  }

  for (const [externalAccountId, events] of eventsByAccount) {
    const found = await channelLookup.findByExternalAccountId("INSTAGRAM", externalAccountId);
    // Conta conectada pelo passo a passo manual é de outro app e tem a própria rota (CA-6).
    if (!found || found.channel.credentials.authMode !== "META_LOGIN") continue;
    await processChannelEvents(found, events, ingestInstagramEventToChat);
  }
  return "processed";
}

/** Para o webhook antigo: nunca derruba o fluxo de leads por DM. */
/** Contas conectadas pela Meta: o tracking-chat recebe as DMs por aqui, e o webhook antigo deixa de duplicar (spec 0062, RF-8). */
export async function isMetaLoginInstagramAccount(externalAccountId: string): Promise<boolean> {
  const found = await channelLookup.findByExternalAccountId("INSTAGRAM", externalAccountId).catch(() => null);
  return found?.channel.credentials.authMode === "META_LOGIN";
}

export async function processMetaCommentsWebhookSafely(input: { rawBody: string; signatureHeader: string | null }) {
  try {
    const outcome = await processMetaCommentsWebhook(input);
    if (outcome === "invalid_signature" && process.env.META_APP_SECRET) {
      socialLogger.warn("Webhook do Instagram sem assinatura válida da Meta; Comments ignorou o lote");
    }
  } catch (error) {
    socialLogger.error("Falha no Comments dentro do webhook do Instagram", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
