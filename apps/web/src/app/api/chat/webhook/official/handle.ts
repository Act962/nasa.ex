/**
 * Handler agnóstico de framework do webhook oficial Meta Cloud API (WhatsApp).
 * Extraído do route.ts pra ser compartilhado entre o Next (apps/web) e a rota
 * Fastify (apps/api). Recebe os parâmetros crus (GET: query; POST: raw body +
 * header de assinatura) e devolve `{ status, body, text? }` — o `text` sinaliza
 * resposta `text/plain` (challenge do handshake / mensagens de erro Meta).
 *
 * Ver documentação completa do contrato Meta em
 * `docs/whatsapp-oficial-overview.md` e no route.ts.
 */
import { timingSafeEqual } from "node:crypto";

import {
  isMetaSignatureValid,
  verifyWebhookChallenge,
} from "@/http/whats-oficial/verify-signature";
import { parseWhatsAppOfficialWebhook } from "@/http/whats-oficial/webhook-schema";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";
import { getTrackingByMetaPhoneNumberId } from "@/features/tracking-chat/lib/get-tracking-by-meta-phone-number-id";
import { getCachedTrackingContext } from "@/features/tracking-chat/lib/get-cached-tracking-context";
import { createProvider } from "@/features/tracking-chat/lib/providers";
import { persistCanonicalInbound } from "@/features/tracking-chat/lib/inbound/persist-canonical-inbound";
import {
  buildMetaDownloadInboundMedia,
  buildMetaFetchProfilePicture,
} from "@/features/tracking-chat/lib/inbound/meta-strategies";

export type WebhookResult = { status: number; body: unknown; text?: boolean };

// ── GET: verify handshake ────────────────────────────────────────────
export async function handleMetaOfficialVerify(params: {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}): Promise<WebhookResult> {
  const { mode, verifyToken, challenge } = params;

  if (!verifyToken) {
    return { status: 403, body: "Forbidden", text: true };
  }

  // ── Tentativa 1: bate contra `META_VERIFY_TOKEN_GLOBAL` (Fase 7) ────
  const globalVerifyToken = process.env.META_VERIFY_TOKEN_GLOBAL;
  let matchedVerifyToken: string | null = null;
  if (globalVerifyToken && constantTimeEquals(globalVerifyToken, verifyToken)) {
    matchedVerifyToken = globalVerifyToken;
  }

  // ── Tentativa 2: scan + decrypt em instâncias com verify token próprio ─
  const candidates = await prisma.whatsAppInstance.findMany({
    where: { provider: WhatsAppProvider.META_CLOUD },
    select: {
      id: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  // Constant-work: itera TODAS as instâncias mesmo após match (anti timing leak).
  for (const candidate of candidates) {
    if (!candidate.metaAccessToken || !candidate.metaPhoneNumberId) {
      continue;
    }
    if (!candidate.metaVerifyToken) continue;
    try {
      const plain = decryptStoredMetaCredentialsPartial({
        metaAccessToken: candidate.metaAccessToken,
        metaPhoneNumberId: candidate.metaPhoneNumberId,
        metaAppSecret: candidate.metaAppSecret,
        metaVerifyToken: candidate.metaVerifyToken,
        metaBusinessAccountId: candidate.metaBusinessAccountId,
      });
      if (
        matchedVerifyToken === null &&
        plain.verifyToken !== null &&
        constantTimeEquals(plain.verifyToken, verifyToken)
      ) {
        matchedVerifyToken = plain.verifyToken;
        // sem break: continua iterando pra constant-work
      }
    } catch (error) {
      console.error(
        "[webhook:official:GET] decrypt_failed",
        { instanceId: candidate.id },
        error,
      );
    }
  }

  if (!matchedVerifyToken) {
    return { status: 403, body: "Forbidden", text: true };
  }

  const challengeText = verifyWebhookChallenge(
    { mode, verifyToken, challenge },
    matchedVerifyToken,
  );

  if (!challengeText) {
    return { status: 403, body: "Forbidden", text: true };
  }

  return { status: 200, body: challengeText, text: true };
}

// ── POST: eventos ────────────────────────────────────────────────────
export async function handleMetaOfficialEvent(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookResult> {
  // ── 1. Parse JSON pra descobrir o phone_number_id ───────────────────
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, reason: "invalid_json" } };
  }

  const phoneNumberIds = extractDistinctPhoneNumberIds(json);
  if (phoneNumberIds.length === 0) {
    return { status: 200, body: { ok: true, skipped: "no_phone_number_id" } };
  }
  if (phoneNumberIds.length > 1) {
    console.warn("[webhook:official:POST] multi_phone_number_id", {
      phoneNumberIds,
    });
    return {
      status: 200,
      body: { ok: true, skipped: "multi_phone_number_id", phoneNumberIds },
    };
  }
  const phoneNumberId = phoneNumberIds[0];

  const instance = await getTrackingByMetaPhoneNumberId(phoneNumberId);
  if (!instance) {
    console.warn("[webhook:official:POST] unknown_phone_number_id", {
      phoneNumberId,
    });
    return { status: 401, body: "Unknown phone_number_id", text: true };
  }

  // ── 3. Validar HMAC ─────────────────────────────────────────────────
  const appSecret = instance.appSecret ?? process.env.META_APP_SECRET ?? null;
  if (!appSecret) {
    console.warn("[webhook:official:POST] no_app_secret_available", {
      phoneNumberId,
      instanceId: instance.instanceId,
      hasInstanceSecret: false,
      hasGlobalSecret: false,
    });
    return { status: 401, body: "App Secret not configured", text: true };
  }
  if (!isMetaSignatureValid(rawBody, signatureHeader, appSecret)) {
    console.warn("[webhook:official:POST] invalid_signature", {
      phoneNumberId,
      instanceId: instance.instanceId,
      hasHeader: Boolean(signatureHeader),
      secretSource: instance.appSecret ? "instance" : "global_env",
    });
    return { status: 401, body: "Invalid signature", text: true };
  }

  // ── 4. Parse Zod ────────────────────────────────────────────────────
  const parsed = parseWhatsAppOfficialWebhook(json);
  if (!parsed) {
    console.warn("[webhook:official:POST] invalid_shape", { phoneNumberId });
    return { status: 200, body: { ok: true, skipped: "invalid_shape" } };
  }

  // ── 5. Tracking context ─────────────────────────────────────────────
  const tracking = await getCachedTrackingContext(instance.trackingId);
  if (!tracking) {
    console.warn("[webhook:official:POST] tracking_not_found_for_instance", {
      instanceId: instance.instanceId,
      trackingId: instance.trackingId,
    });
    return { status: 200, body: { ok: true, skipped: "tracking_not_found" } };
  }

  // ── 6. Provider + normalizeInbound ──────────────────────────────────
  const provider = createProvider("meta-cloud", {
    accessToken: instance.accessToken,
    phoneNumberId: instance.phoneNumberId,
    appSecret: instance.appSecret,
  });

  const normalized = provider.normalizeInbound(parsed);
  if (!normalized || normalized.messages.length === 0) {
    console.log("[webhook:official:POST] skipped_status_updates", {
      phoneNumberId,
      count: normalized?.statusUpdates?.length ?? 0,
    });
    return { status: 200, body: { ok: true, skipped: "no_canonical_messages" } };
  }

  // ── 6.1. Mapa wamid → raw message (pra CTWA / referral) ────────────
  const rawByWamid = buildRawMessageMap(parsed);

  // ── 7. Astro-bot intercept ──────────────────────────────────────────
  const textCandidates = normalized.messages.filter(
    (message) => message.type === "text",
  );
  if (normalized.messages.length === 1 && textCandidates.length === 1) {
    const candidate = textCandidates[0];
    if (candidate.type === "text") {
      const bodyForBot = candidate.body.trim();
      if (bodyForBot) {
        try {
          const { maybeHandleBotMessage } = await import(
            "@/features/astro-bot/lib/webhook-handler"
          );
          const botResult = await maybeHandleBotMessage({
            fromPhone: candidate.sender.phone,
            messageText: bodyForBot,
            receivingInstanceToken: instance.accessToken,
            trackingOrganizationId: tracking.organizationId,
          });
          if (botResult.handled) {
            return {
              status: 200,
              body: {
                ok: true,
                handledBy: "astro-bot",
                bindingId: botResult.bindingId,
                status: botResult.status,
              },
            };
          }
        } catch (error) {
          console.error(
            "[webhook:official:POST] astro_bot_intercept_failed",
            error,
          );
          // segue pro pipeline normal
        }
      }
    }
  } else if (textCandidates.length > 0 && normalized.messages.length > 1) {
    console.log("[webhook:official:POST] astro_bot_skipped_multi_message", {
      phoneNumberId,
      totalMessages: normalized.messages.length,
      textMessages: textCandidates.length,
    });
  }

  // ── 8. Strategies Meta + pipeline canônica ──────────────────────────
  const fetchProfilePicture = buildMetaFetchProfilePicture(instance.accessToken);
  const downloadInboundMedia = buildMetaDownloadInboundMedia(
    instance.accessToken,
  );

  const results: Array<Awaited<ReturnType<typeof persistCanonicalInbound>>> = [];
  for (const canonical of normalized.messages) {
    try {
      const rawMessage = rawByWamid.get(canonical.externalMessageId);
      const ctwaSources = rawMessage ? [rawMessage, parsed] : [parsed];

      const result = await persistCanonicalInbound(canonical, {
        trackingId: instance.trackingId,
        providerId: "meta-cloud",
        fetchProfilePicture,
        downloadInboundMedia,
        ctwaSources,
        channel: "WHATSAPP",
      });
      results.push(result);
    } catch (error) {
      console.error("[webhook:official:POST] persist_threw", {
        externalMessageId: canonical.externalMessageId,
        error,
      });
      results.push({ ok: false, reason: "persist_threw" });
    }
  }

  // ── 9. Mapeia falhas ────────────────────────────────────────────────
  const firstFailure = results.find((result) => !result.ok);
  if (firstFailure && !firstFailure.ok) {
    if (
      firstFailure.reason === "tracking_not_found" ||
      firstFailure.reason === "lead_creation_failed"
    ) {
      console.warn("[webhook:official:POST] non_retryable_failure", {
        phoneNumberId,
        reason: firstFailure.reason,
      });
      return {
        status: 200,
        body: { ok: true, skipped: firstFailure.reason, results },
      };
    }
    return {
      status: 500,
      body: { ok: false, reason: firstFailure.reason, results },
    };
  }

  return { status: 200, body: { ok: true, results } };
}

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Peek no JSON pra extrair todos os `phone_number_id` distintos. NÃO valida Zod
 * aqui — isso vem depois, após o HMAC bater.
 */
function extractDistinctPhoneNumberIds(raw: unknown): string[] {
  const found = new Set<string>();
  if (!raw || typeof raw !== "object") return [];
  const root = raw as { entry?: unknown };
  if (!Array.isArray(root.entry)) return [];
  for (const entry of root.entry) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== "object") continue;
      const metadata = (value as { metadata?: unknown }).metadata;
      if (!metadata || typeof metadata !== "object") continue;
      const phoneNumberId = (metadata as { phone_number_id?: unknown })
        .phone_number_id;
      if (typeof phoneNumberId === "string" && phoneNumberId.length > 0) {
        found.add(phoneNumberId);
      }
    }
  }
  return [...found];
}

/**
 * Constrói o mapa `wamid → raw message` pra recuperar o `referral` cru no
 * caminho de CTWA (perdido pelo normalizer canônico). Tolerante a shape inesperado.
 */
function buildRawMessageMap(parsed: {
  entry?: Array<{ changes?: Array<{ value?: { messages?: unknown } }> }>;
}): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (!parsed.entry) return map;
  for (const entry of parsed.entry) {
    if (!entry.changes) continue;
    for (const change of entry.changes) {
      const messages = change?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const id = (message as { id?: unknown }).id;
        if (typeof id === "string" && id.length > 0) {
          map.set(id, message);
        }
      }
    }
  }
  return map;
}

/**
 * Comparação timing-safe de strings UTF-8 (diferença de length também mascarada).
 * Usado no GET handshake.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  const length = Math.max(bufferA.length, bufferB.length);
  const padA = Buffer.alloc(length);
  const padB = Buffer.alloc(length);
  bufferA.copy(padA);
  bufferB.copy(padB);
  const lengthsMatch = bufferA.length === bufferB.length;
  const contentMatch = timingSafeEqual(padA, padB);
  return lengthsMatch && contentMatch;
}
