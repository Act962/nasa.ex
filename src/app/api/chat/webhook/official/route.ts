/**
 * Webhook oficial Meta Cloud API (Fase 5 — Roadmap WhatsApp Oficial).
 *
 * Endpoint compartilhado por **todas** as instâncias `META_CLOUD` da
 * plataforma — diferente do Uazapi (`/api/chat/webhook?trackingId=...`),
 * a Meta não permite querystring custom no Webhook URL. O roteamento
 * pra tracking acontece via `entry[].changes[].value.metadata.phone_
 * number_id` → `WhatsAppInstance.metaPhoneNumberId` (plaintext + `@unique`,
 * resolvido em sub-ms via `getTrackingByMetaPhoneNumberId`).
 *
 * ## Contratos Meta
 *
 *  - **GET `?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`**
 *    → handshake de verificação. Responder `200 text/plain` com o
 *    `challenge` cru quando o verify_token bater, `403` caso contrário.
 *    O verify_token é **por instância** (vem cifrado em
 *    `metaVerifyToken`). Como a Meta entrega só o token (sem outro
 *    identificador), aceitamos se **qualquer** instância `META_CLOUD`
 *    tiver esse token configurado.
 *
 *  - **POST** → eventos. Body de `application/json`; assinatura HMAC-
 *    SHA256 do **raw body** com o `appSecret` no header
 *    `x-hub-signature-256: sha256=<hex>`. Fail-closed: assinatura
 *    inválida → 401 + skip total.
 *
 * ## Política de status (anti-retry Meta)
 *
 * A Meta **retenta agressivamente** em respostas != 2xx (backoff
 * exponencial por horas). Pra evitar dead-letter, retornamos 200 em
 * **erros que não se resolvem com retry**:
 *  - Body sem assinatura/inválido → 401 (config errada no remetente, não
 *    queremos retry).
 *  - Body válido mas tracking não encontrado / lead_creation_failed →
 *    **200 + log** (config nossa; retry inútil).
 *  - Mensagens persistidas / skip silencioso (reaction/unsupported) → 200.
 *  - Race transiente (`lead_reload_failed`, `conversation_missing`) →
 *    500 (queremos retry).
 *
 * ## Astro-bot intercept
 *
 * Replicado do webhook Uazapi: se a mensagem for texto puro e o remetente
 * for um membro com `UserWhatsappBinding`, intercepta antes da
 * persistência. Pro Meta o `receivingInstanceToken` que o handler exige
 * é o `accessToken` da instância — preserva semântica de "token que
 * recebeu a mensagem".
 */
import { type NextRequest, NextResponse } from "next/server";
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

// ── GET: verify handshake ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!verifyToken) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Tentativa 1: bate contra `META_VERIFY_TOKEN_GLOBAL` (Fase 7) ────
  // Instâncias provisionadas via Embedded Signup não têm
  // `metaVerifyToken` próprio — usam o token global da App da NASA.
  // Verificação em timing-safe pra não vazar via timing.
  const globalVerifyToken = process.env.META_VERIFY_TOKEN_GLOBAL;
  let matchedVerifyToken: string | null = null;
  if (
    globalVerifyToken &&
    constantTimeEquals(globalVerifyToken, verifyToken)
  ) {
    matchedVerifyToken = globalVerifyToken;
  }

  // ── Tentativa 2: scan + decrypt em instâncias com verify token próprio ─
  // Backward compat com Fase 4 — instâncias antigas têm `metaVerifyToken`
  // gravado e podem ser diferentes do global. Como vem cifrado com IV
  // randômico, precisa scan + decrypt. Mais raro que o POST (handshake é
  // uma vez por configuração), então não cacheamos.
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

  // Constant-work: itera TODAS as instâncias mesmo após match, decifra e
  // compara em timing-safe. Sem isso, atacante poderia inferir (a) o
  // tamanho do parque META_CLOUD via timing do break, e (b) extrair o
  // verify_token char-a-char (`===` em strings termina no 1º char
  // divergente). Custo: scan completo do subset META_CLOUD, mas o GET é
  // chamado uma vez por configuração (não é hot path).
  for (const candidate of candidates) {
    if (!candidate.metaAccessToken || !candidate.metaPhoneNumberId) {
      continue;
    }
    // Instâncias sem verify token próprio (Embedded Signup, Fase 7) já
    // foram cobertas pelo `META_VERIFY_TOKEN_GLOBAL` acima. Aqui só
    // testamos as que têm token específico (Fase 4 backward compat).
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
    return new NextResponse("Forbidden", { status: 403 });
  }

  const challengeText = verifyWebhookChallenge(
    { mode, verifyToken, challenge },
    matchedVerifyToken,
  );

  if (!challengeText) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challengeText, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

// ── POST: eventos ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── 1. Ler RAW body ANTES de qualquer parse ─────────────────────────
  // O HMAC depende do byte-exato. JSON.parse + re-stringify quebra a
  // assinatura.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (error) {
    console.error("[webhook:official:POST] body_read_failed", error);
    return NextResponse.json({ ok: false, reason: "body_read_failed" }, { status: 400 });
  }

  // ── 2. Parse JSON pra descobrir o phone_number_id ───────────────────
  // (Precisamos do phone_number_id pra achar a instância → appSecret pra
  // validar HMAC. Sem o appSecret correto, não dá pra validar a
  // assinatura. Ordem: peek no JSON pra extrair só metadata.phone_
  // number_id; SE bater alguma instância, valida HMAC com o appSecret
  // dela; se a assinatura bate, segue.)
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_json" },
      { status: 400 },
    );
  }

  const phoneNumberIds = extractDistinctPhoneNumberIds(json);
  if (phoneNumberIds.length === 0) {
    // Body válido mas sem `metadata.phone_number_id` — provavelmente
    // evento não relacionado a mensagens (account_update, template_
    // status_update etc.). Reconhecemos com 200 pra Meta não retry.
    return NextResponse.json(
      { ok: true, skipped: "no_phone_number_id" },
      { status: 200 },
    );
  }
  if (phoneNumberIds.length > 1) {
    // Meta normalmente agrupa por subscription (1 phone_number_id por
    // POST), mas o shape do envelope permite N entries → N WABAs.
    // Como o HMAC é do POST inteiro com appSecret da App e o lookup é
    // por instância (cada uma com seu appSecret), multi-distinct cai
    // em ambiguidade que pode gravar mensagens no tracking errado.
    // Rejeitamos pra inspeção manual. Doc §8 Riscos.
    console.warn("[webhook:official:POST] multi_phone_number_id", {
      phoneNumberIds,
    });
    return NextResponse.json(
      { ok: true, skipped: "multi_phone_number_id", phoneNumberIds },
      { status: 200 },
    );
  }
  const phoneNumberId = phoneNumberIds[0];

  const instance = await getTrackingByMetaPhoneNumberId(phoneNumberId);
  if (!instance) {
    // Phone number id não está em nenhuma WhatsAppInstance META_CLOUD.
    // Sem appSecret correspondente, NÃO podemos validar HMAC. Retorna
    // 401 pra Meta — config errada na Meta App (webhook apontando pra
    // ambiente errado, número desativado, etc.). 401 (4xx) faz Meta
    // parar de retry; 200 esconderia o problema.
    console.warn("[webhook:official:POST] unknown_phone_number_id", {
      phoneNumberId,
    });
    return new NextResponse("Unknown phone_number_id", { status: 401 });
  }

  // ── 3. Validar HMAC ─────────────────────────────────────────────────
  // Fase 7: instâncias provisionadas via Embedded Signup têm
  // `instance.appSecret === null` — caem pro `META_APP_SECRET` global do
  // App da NASA. Instâncias Fase 4 mantêm o appSecret próprio. Sem
  // nenhum dos dois, não dá pra validar — retorna 401 (config errada).
  const appSecret =
    instance.appSecret ?? process.env.META_APP_SECRET ?? null;
  if (!appSecret) {
    console.warn("[webhook:official:POST] no_app_secret_available", {
      phoneNumberId,
      instanceId: instance.instanceId,
      hasInstanceSecret: false,
      hasGlobalSecret: false,
    });
    return new NextResponse("App Secret not configured", { status: 401 });
  }
  const signatureHeader = request.headers.get("x-hub-signature-256");
  if (!isMetaSignatureValid(rawBody, signatureHeader, appSecret)) {
    console.warn("[webhook:official:POST] invalid_signature", {
      phoneNumberId,
      instanceId: instance.instanceId,
      hasHeader: Boolean(signatureHeader),
      secretSource: instance.appSecret ? "instance" : "global_env",
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // ── 4. Parse Zod ────────────────────────────────────────────────────
  const parsed = parseWhatsAppOfficialWebhook(json);
  if (!parsed) {
    // Body assinado certo mas shape inesperado — log e 200 pra Meta
    // não retry (é evento de outro tipo, ou shape novo que não
    // suportamos ainda).
    console.warn("[webhook:official:POST] invalid_shape", { phoneNumberId });
    return NextResponse.json(
      { ok: true, skipped: "invalid_shape" },
      { status: 200 },
    );
  }

  // ── 5. Tracking context (organizationId pra astro-bot + tracking ok) ─
  const tracking = await getCachedTrackingContext(instance.trackingId);
  if (!tracking) {
    // Instância existe mas tracking foi deletado (incoerência rara). 200
    // pra Meta não retry; sinaliza pra operações.
    console.warn("[webhook:official:POST] tracking_not_found_for_instance", {
      instanceId: instance.instanceId,
      trackingId: instance.trackingId,
    });
    return NextResponse.json(
      { ok: true, skipped: "tracking_not_found" },
      { status: 200 },
    );
  }

  // ── 6. Provider + normalizeInbound ──────────────────────────────────
  const provider = createProvider("meta-cloud", {
    accessToken: instance.accessToken,
    phoneNumberId: instance.phoneNumberId,
    appSecret: instance.appSecret,
  });

  const normalized = provider.normalizeInbound(parsed);
  if (!normalized || normalized.messages.length === 0) {
    // Webhook traz só statuses (sent/delivered/read/failed) — pipeline
    // canônica ainda não persiste statuses (Fase 6+). Log estruturado
    // pra dimensionar o volume antes de implementar.
    console.log("[webhook:official:POST] skipped_status_updates", {
      phoneNumberId,
      count: normalized?.statusUpdates?.length ?? 0,
    });
    return NextResponse.json(
      { ok: true, skipped: "no_canonical_messages" },
      { status: 200 },
    );
  }

  // ── 6.1. Mapa wamid → raw message (pra CTWA / referral) ────────────
  // O canonical perde o `referral` cru da Meta (ele só aparece em
  // `messages[].referral` do envelope). `persistCanonicalInbound` passa
  // os `ctwaSources` rest-args pro resolver, que lê `src.referral` no
  // top-level. Por isso construímos `rawByWamid` aqui pra cada
  // mensagem chamar `persist` com `[rawMessage, parsed]` em vez de
  // `[canonical, parsed]` (canonical não tem `referral`).
  const rawByWamid = buildRawMessageMap(parsed);

  // ── 7. Astro-bot intercept ──────────────────────────────────────────
  // Replica o branch do Uazapi pra texto puro. Só intercepta quando há
  // **exatamente 1 mensagem texto** no POST — Meta agrupa N messages
  // por POST; se interceptamos a primeira como comando bot e
  // retornamos, perderíamos as outras (mídia / texto subsequente que
  // NÃO É comando). Conservador é seguro: caso raro de bot + outras
  // mensagens no mesmo POST cai no fluxo normal (admin do bot reenvia
  // se necessário; nada se perde silenciosamente).
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
            trackingId: instance.trackingId,
            trackingOrganizationId: tracking.organizationId,
          });
          if (botResult.handled) {
            return NextResponse.json(
              {
                ok: true,
                handledBy: "astro-bot",
                bindingId: botResult.bindingId,
                status: botResult.status,
              },
              { status: 200 },
            );
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
      // CTWA: o `referral` cru vive em `messages[].referral` do
      // envelope Meta — não no canonical. Buscamos pelo wamid e
      // passamos como primeira source (o resolver tenta cada source
      // até achar `referral` no top-level).
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
      // Treat thrown como reason genérica pra mapeamento abaixo.
      results.push({ ok: false, reason: "persist_threw" });
    }
  }

  // ── 9. Mapeia falhas ────────────────────────────────────────────────
  // Política anti-retry: tracking_not_found e lead_creation_failed
  // viram 200 + log (config nossa). Race transiente vira 500 pra Meta
  // retry. Tudo certo → 200.
  const firstFailure = results.find((r) => !r.ok);
  if (firstFailure && !firstFailure.ok) {
    if (
      firstFailure.reason === "tracking_not_found" ||
      firstFailure.reason === "lead_creation_failed"
    ) {
      console.warn("[webhook:official:POST] non_retryable_failure", {
        phoneNumberId,
        reason: firstFailure.reason,
      });
      return NextResponse.json(
        { ok: true, skipped: firstFailure.reason, results },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { ok: false, reason: firstFailure.reason, results },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, results }, { status: 200 });
}

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Peek no JSON pra extrair todos os `phone_number_id` distintos. A
 * Meta agrupa `entry[]` por subscription — em produção quase sempre é
 * 1 só, mas em tese pode entregar entries de WABAs diferentes no mesmo
 * POST. Como o HMAC do POST é assinado com o `appSecret` da App (uma
 * só) e o lookup das credenciais é por instância, multi-distinct é
 * cenário ambíguo: rejeitamos o batch pra inspeção manual em vez de
 * arriscar gravar mensagens no tracking errado.
 *
 * NÃO valida Zod aqui — isso vem depois, após HMAC bater.
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
 * Constrói o mapa `wamid → raw message` percorrendo o envelope
 * parseado. Usado pra recuperar o `referral` cru no caminho de CTWA
 * (perdido pelo normalizer canônico). Tolerante a shape inesperado.
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
 * Comparação timing-safe de strings UTF-8. Difference de length também
 * é mascarada (compara em buffers do mesmo tamanho preenchidos com
 * zeros pra alinhar). Usado no GET handshake e em qualquer lugar onde a
 * variação de timing pode vazar info sensível.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // timingSafeEqual exige tamanhos iguais — usamos pad pra fazer a
  // checagem do tamanho também ser constant-time.
  const length = Math.max(bufferA.length, bufferB.length);
  const padA = Buffer.alloc(length);
  const padB = Buffer.alloc(length);
  bufferA.copy(padA);
  bufferB.copy(padB);
  const lengthsMatch = bufferA.length === bufferB.length;
  const contentMatch = timingSafeEqual(padA, padB);
  return lengthsMatch && contentMatch;
}

