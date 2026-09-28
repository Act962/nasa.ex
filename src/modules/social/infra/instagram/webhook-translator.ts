import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundEvent } from "../../domain/types";
import type { InboundTranslator } from "../../ports/inbound-translator";

const SIGNATURE_PREFIX = "sha256=";

type InstagramWebhookPayload = {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    messaging?: {
      sender?: { id?: string };
      timestamp?: number;
      message?: { mid?: string; text?: string; is_echo?: boolean };
    }[];
    changes?: {
      field?: string;
      value?: {
        id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string };
      };
    }[];
  }[];
};

/**
 * Tradutor do webhook do Instagram.
 *
 * Espelha `src/http/whats-oficial/verify-signature.ts`, que é o padrão de
 * referência do projeto: HMAC sobre o raw body, comparação em tempo constante,
 * fail-closed — qualquer erro inesperado vira `false`, nunca exceção.
 */
export class InstagramWebhookTranslator implements InboundTranslator {
  verifySignature(input: {
    rawBody: string;
    signatureHeader: string | null;
    appSecret: string;
  }): boolean {
    try {
      const { rawBody, signatureHeader, appSecret } = input;
      if (!signatureHeader || !appSecret) return false;
      if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

      const received = signatureHeader.slice(SIGNATURE_PREFIX.length);
      const expected = createHmac("sha256", appSecret)
        .update(rawBody, "utf8")
        .digest("hex");

      if (received.length !== expected.length) return false;
      return timingSafeEqual(
        Buffer.from(received, "hex"),
        Buffer.from(expected, "hex"),
      );
    } catch {
      return false;
    }
  }

  parse(payload: unknown): InboundEvent[] {
    const body = payload as InstagramWebhookPayload;
    const events: InboundEvent[] = [];

    for (const entry of body?.entry ?? []) {
      const externalAccountId = entry.id;
      if (!externalAccountId) continue;

      for (const messaging of entry.messaging ?? []) {
        const message = messaging.message;
        // `is_echo` é a própria conta mandando — entra aqui como eco do que a
        // automação acabou de enviar (spec 0024 CB-2).
        if (!message?.mid || message.is_echo) continue;
        const senderId = messaging.sender?.id;
        if (!senderId) continue;

        events.push({
          provider: "INSTAGRAM",
          externalAccountId,
          externalEventId: message.mid,
          type: "DIRECT_MESSAGE_RECEIVED",
          actor: { externalUserId: senderId },
          text: message.text ?? "",
          occurredAt: messaging.timestamp
            ? new Date(messaging.timestamp)
            : new Date(),
        });
      }

      for (const change of entry.changes ?? []) {
        // Campos que não são `comments` (mentions, live_comments) são ignorados
        // sem erro — spec 0024 CB-13.
        if (change.field !== "comments") continue;
        const value = change.value;
        if (!value?.id || !value.from?.id) continue;

        events.push({
          provider: "INSTAGRAM",
          externalAccountId,
          externalEventId: value.id,
          type: "COMMENT_CREATED",
          actor: {
            externalUserId: value.from.id,
            username: value.from.username,
          },
          text: value.text ?? "",
          content: value.media?.id ? { externalId: value.media.id } : undefined,
          occurredAt: entry.time ? new Date(entry.time) : new Date(),
        });
      }
    }

    return events;
  }
}
