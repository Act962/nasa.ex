import "server-only";

import { randomInt } from "node:crypto";

import {
  exchangeCodeForToken,
  subscribeApp,
  registerPhone,
  getPhoneNumbers,
  getWaba,
} from "@/http/whats-oficial";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { clearMetaPhoneNumberIdLookupCache } from "@/features/tracking-chat/lib/get-cached-tracking-by-meta-phone-number-id";
import { invalidateOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { encryptMetaCredentialsInput } from "@/features/tracking-chat/lib/providers/meta-credentials";
import { logEmbeddedSignup } from "./logger";

/**
 * Orquestra o onboarding via Embedded Signup (Fase 7 — Roadmap WhatsApp
 * Oficial). Entrada vem do callback do FB SDK no frontend; este helper
 * cuida do server-to-server inteiro:
 *
 *   1. Troca `code` por Business Integration System User Access Token.
 *   2. Inscreve o App da NASA pra receber webhooks da WABA do cliente.
 *   3. Gera PIN aleatório 6 dígitos e registra o número na Cloud API.
 *   4. Lê metadados da WABA + lista de números (confirma acesso).
 *   5. Atualiza `WhatsAppInstance` com `provider=META_CLOUD` + tokens
 *      cifrados. **NÃO** preenche `metaAppSecret`/`metaVerifyToken` —
 *      esses passam a vir de env globais (Fase 7.3).
 *   6. Invalida caches (lookup do webhook + outbound).
 *
 * **Decisão de escopo (Fase 7):** este helper só *promove* uma instância
 * Uazapi existente pra META_CLOUD. Tracking sem `WhatsAppInstance`
 * precisa criar pelo fluxo Uazapi padrão primeiro. Razão: a coluna
 * `WhatsAppInstance.{instanceName,instanceId,apiKey,baseUrl}` continua
 * required no schema (legado Uazapi); criar placeholder aqui sujaria o
 * domínio.
 */

interface OnboardInput {
  /** `WhatsAppInstance.trackingId` — tracking onde gravar o provider. */
  trackingId: string;
  /** Authorization code retornado pelo `FB.login` (TTL 30s). */
  code: string;
  /** `waba_id` retornado no `postMessage WA_EMBEDDED_SIGNUP`. */
  wabaId: string;
  /** `phone_number_id` retornado no `postMessage WA_EMBEDDED_SIGNUP`. */
  phoneNumberId: string;
  /** `business_id` retornado no `postMessage` (opcional — nem todo flow expõe). */
  businessId?: string;
  /** Org dona do tracking (vem do contexto de auth do oRPC). */
  organizationId: string;
}

export interface OnboardResult {
  instanceId: string;
  provider: WhatsAppProvider;
  wabaName: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

export class EmbeddedSignupConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddedSignupConfigError";
  }
}

export class EmbeddedSignupInstanceMissingError extends Error {
  constructor(trackingId: string) {
    super(
      `Tracking ${trackingId} não tem WhatsAppInstance. Crie uma instância Uazapi primeiro e depois promova pra Meta via Embedded Signup.`,
    );
    this.name = "EmbeddedSignupInstanceMissingError";
  }
}

export class EmbeddedSignupPhoneMismatchError extends Error {
  constructor(expected: string, got: string[]) {
    super(
      `Phone Number ID ${expected} não está na WABA. Encontrados: ${got.join(", ") || "(nenhum)"}.`,
    );
    this.name = "EmbeddedSignupPhoneMismatchError";
  }
}

export async function onboardWhatsAppEmbeddedSignup(
  input: OnboardInput,
): Promise<OnboardResult> {
  const startedAt = Date.now();
  logEmbeddedSignup({
    event: "code_received",
    trackingId: input.trackingId,
    organizationId: input.organizationId,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
  });

  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    logEmbeddedSignup({
      event: "failed",
      trackingId: input.trackingId,
      organizationId: input.organizationId,
      failureKind: "config_missing",
      detail: "META_APP_ID/META_APP_SECRET",
    });
    throw new EmbeddedSignupConfigError(
      "META_APP_ID/META_APP_SECRET ausentes. Configure as envs do App Meta antes de usar Embedded Signup.",
    );
  }

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId: input.trackingId },
    select: { id: true, organizationId: true },
  });

  if (!instance) {
    throw new EmbeddedSignupInstanceMissingError(input.trackingId);
  }
  if (instance.organizationId !== input.organizationId) {
    throw new EmbeddedSignupInstanceMissingError(input.trackingId);
  }

  // ── Passo 1: code → BISUAT ────────────────────────────────────────────
  let accessToken: string;
  try {
    const tokenResponse = await exchangeCodeForToken({
      code: input.code,
      clientId,
      clientSecret,
    });
    accessToken = tokenResponse.access_token;
  } catch (error) {
    logEmbeddedSignup({
      event: "failed",
      trackingId: input.trackingId,
      organizationId: input.organizationId,
      failureKind: "token_exchange_failed",
      elapsedMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : "unknown",
      fbtraceId: extractFbtrace(error),
    });
    throw error;
  }
  logEmbeddedSignup({
    event: "token_exchanged",
    trackingId: input.trackingId,
    organizationId: input.organizationId,
    wabaId: input.wabaId,
    elapsedMs: Date.now() - startedAt,
  });

  // ── Passo 2: subscribe webhook na WABA do cliente ────────────────────
  // Idempotente: subscrever 2x na mesma WABA retorna { success: true }
  // sem erro. Se vier erro, propaga — re-onboard deve ser raro.
  try {
    await subscribeApp({ wabaId: input.wabaId, accessToken });
  } catch (error) {
    logEmbeddedSignup({
      event: "failed",
      trackingId: input.trackingId,
      organizationId: input.organizationId,
      failureKind: "subscribe_failed",
      elapsedMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : "unknown",
      fbtraceId: extractFbtrace(error),
    });
    throw error;
  }
  logEmbeddedSignup({
    event: "subscribed",
    trackingId: input.trackingId,
    wabaId: input.wabaId,
    elapsedMs: Date.now() - startedAt,
  });

  // ── Passo 3: gerar PIN + registrar número ─────────────────────────────
  // PIN é gerado server-side, usado uma vez aqui, descartado (decisão #3
  // do plano Fase 7). Cliente nunca precisa ver. Se Meta exigir reset,
  // cliente faz no painel Meta direto.
  const pin = generateTwoFactorPin();
  try {
    await registerPhone({
      phoneNumberId: input.phoneNumberId,
      pin,
      accessToken,
    });
  } catch (error) {
    // Tratar "already registered" como sucesso silencioso. Meta retorna
    // erro distinto mas o efeito prático é o mesmo — número operacional.
    if (!isAlreadyRegisteredError(error)) {
      logEmbeddedSignup({
        event: "failed",
        trackingId: input.trackingId,
        organizationId: input.organizationId,
        failureKind: "register_failed",
        elapsedMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : "unknown",
        fbtraceId: extractFbtrace(error),
      });
      throw error;
    }
  }
  logEmbeddedSignup({
    event: "registered",
    trackingId: input.trackingId,
    phoneNumberId: input.phoneNumberId,
    elapsedMs: Date.now() - startedAt,
  });

  // ── Passo 4: confirmar acesso + capturar metadados ───────────────────
  // getWaba serve de smoke test (se token não tem permissão na WABA,
  // falha aqui antes da gente persistir). getPhoneNumbers confirma que
  // o phone_number_id está mesmo nessa WABA — defesa contra postMessage
  // adulterado (mesmo com origin-check, fan-out de defesa).
  const [wabaInfo, phoneNumbersList] = await Promise.all([
    getWaba({ wabaId: input.wabaId, accessToken }),
    getPhoneNumbers({ wabaId: input.wabaId, accessToken }),
  ]);

  const matchedPhone = phoneNumbersList.data.find(
    (phone) => phone.id === input.phoneNumberId,
  );

  if (!matchedPhone) {
    logEmbeddedSignup({
      event: "failed",
      trackingId: input.trackingId,
      organizationId: input.organizationId,
      failureKind: "phone_mismatch",
      elapsedMs: Date.now() - startedAt,
      detail: `Phone ${input.phoneNumberId} not in WABA`,
    });
    throw new EmbeddedSignupPhoneMismatchError(
      input.phoneNumberId,
      phoneNumbersList.data.map((phone) => phone.id),
    );
  }
  logEmbeddedSignup({
    event: "phone_validated",
    trackingId: input.trackingId,
    phoneNumberId: input.phoneNumberId,
    elapsedMs: Date.now() - startedAt,
  });

  // ── Passo 5: persistir cifrado ────────────────────────────────────────
  // Só preenchemos os 3 campos auto-providos. metaAppSecret e
  // metaVerifyToken ficam NULL — vão usar env global (Fase 7.3
  // implementará o fallback no webhook). Instâncias da Fase 4 continuam
  // funcionando porque o webhook prioriza coluna sobre env.
  const credentials = encryptMetaCredentialsInput({
    accessToken,
    phoneNumberId: input.phoneNumberId,
    businessAccountId: input.wabaId,
    // metaAppSecret e metaVerifyToken NÃO informados → undefined →
    // Prisma não toca nessas colunas (preserva NULL pra novas instâncias).
  });

  const updated = await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: {
      provider: WhatsAppProvider.META_CLOUD,
      ...credentials,
    },
    select: { id: true, provider: true },
  });

  // ── Passo 6: invalidar caches ─────────────────────────────────────────
  // metaPhoneNumberId mudou (ou apareceu pela primeira vez), e provider
  // virou META_CLOUD. Os dois caches in-process precisam refletir.
  clearMetaPhoneNumberIdLookupCache();
  invalidateOutboundProvider(input.trackingId);

  logEmbeddedSignup({
    event: "completed",
    trackingId: input.trackingId,
    organizationId: input.organizationId,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    elapsedMs: Date.now() - startedAt,
  });

  return {
    instanceId: updated.id,
    provider: updated.provider,
    wabaName: wabaInfo.name ?? null,
    displayPhoneNumber: matchedPhone.display_phone_number ?? null,
    verifiedName: matchedPhone.verified_name ?? null,
  };
}

function extractFbtrace(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const metaError = (error as { metaError?: { fbtrace_id?: string } }).metaError;
  return metaError?.fbtrace_id;
}

function generateTwoFactorPin(): string {
  // Faixa [100000, 999999] — sempre 6 dígitos. randomInt é
  // criptograficamente forte (CSPRNG).
  return String(randomInt(100000, 1_000_000));
}

function isAlreadyRegisteredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already_registered") ||
    // Meta error code 133005 / 133006: "Account already registered" /
    // "Two-step verification PIN mismatch" — variam por sub-flow.
    message.includes("code=133005") ||
    message.includes("code=133006")
  );
}
