import "server-only";
import { getInboundTranslator, socialLogger } from "@/modules/social";
import type { Channel } from "@/modules/social/domain/types";
import { dispatchInstagramEventsByAccount } from "./instagram-event-dispatch";

/**
 * Contas conectadas pelo passo a passo (app próprio do cliente). A Meta aceita uma URL por
 * app, então as contas de um mesmo app chegam juntas: cada uma é conferida com a chave
 * secreta dela — é o que prova que o evento veio do app em que ela foi conectada.
 */
export function acceptsChannelSignedWithOwnSecret(input: { rawBody: string; signatureHeader: string | null }) {
  const translator = getInboundTranslator("INSTAGRAM");
  const signatureByAppSecret = new Map<string, boolean>();

  return (channel: Channel): boolean => {
    // Conta conectada pela Meta tem o webhook da plataforma (/api/social/webhook/meta).
    if (channel.credentials.authMode === "META_LOGIN") return false;

    const { appSecret } = channel.credentials;
    let isSignatureValid = signatureByAppSecret.get(appSecret);
    if (isSignatureValid === undefined) {
      isSignatureValid = translator.verifySignature({ ...input, appSecret });
      signatureByAppSecret.set(appSecret, isSignatureValid);
    }
    if (!isSignatureValid) {
      socialLogger.warn("Assinatura inválida no webhook do Instagram; confira a chave secreta da conta", { channelId: channel.id });
    }
    return isSignatureValid;
  };
}

/**
 * URL única. Assinatura inválida de uma conta não vira 401: com uma URL por app, a Meta
 * desligaria a entrega de todas as contas por causa de uma chave errada.
 */
export async function processInstagramAppWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<"processed" | "invalid_json"> {
  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return "invalid_json";
  }

  const events = getInboundTranslator("INSTAGRAM").parse(payload);
  await dispatchInstagramEventsByAccount(events, acceptsChannelSignedWithOwnSecret(input));
  return "processed";
}
