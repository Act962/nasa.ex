import "server-only";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { createProvider } from "./factory";
import {
  decryptStoredMetaCredentials,
  MetaCredentialsMissingError,
} from "./meta-credentials";
import {
  InstanceNotFoundError,
  MetaCredentialsIncompleteError,
} from "./outbound-errors";
import type { ProviderId, WhatsAppChatProvider } from "./types";

/**
 * Resolve o `WhatsAppChatProvider` outbound de um tracking (Fase 6).
 *
 * O **único** ponto onde os handlers `router/message/*` falam HTTP de
 * provider. Carrega `WhatsAppInstance` por `trackingId` (PK lookup via
 * `@unique`), lê o `provider` salvo, decifra credenciais Meta se for o
 * caso e instancia o adapter via `createProvider(id, config)` da factory
 * registrada na Fase 2.
 *
 * Cache in-process com TTL curto (30s):
 *  - Provider+credenciais raramente mudam (alterações via UI invalidam
 *    o cache com `invalidateOutboundProviderCache`).
 *  - Cada send dispara um lookup; sem cache, é uma query Prisma + uma
 *    decifragem AES-GCM por mensagem.
 *  - Multi-instância OK (cada processo mantém seu cache; staleness
 *    limitado ao TTL).
 *
 * Por que retornar o `provider` (`WhatsAppChatProvider`) + também o
 * `providerId` (string) e o `instance` cru: o caller frequentemente
 * precisa saber qual provider tá ativo pra decidir comportamento
 * Uazapi-specific (ex.: `markInstanceConnectionFailure`,
 * `shouldSkipUazapiForConversation`) — sem dispatch dinâmico no caller,
 * a simetria fica feia. Expor `providerId` resolve isso com um campo.
 */

const TTL_MS = 30_000;

export interface ResolvedOutboundProvider {
  /** Provider instanciado (via factory) pronto pra `send*`. */
  readonly provider: WhatsAppChatProvider;
  /** ID estável do provider — `"uazapi"` ou `"meta-cloud"`. */
  readonly providerId: ProviderId;
  /** ID interno da `WhatsAppInstance` (audit / In-Chat fallback). */
  readonly instanceId: string;
  /** ID da organização dona da instância — útil pra audit log sem extra query. */
  readonly organizationId: string;
  /**
   * Token Uazapi em claro quando `providerId === "uazapi"`. Permite
   * helpers Uazapi-specific (ex.: `markInstanceConnectionFailure`)
   * continuarem funcionando sem novo lookup. `undefined` para Meta.
   */
  readonly uazapiToken?: string;
}

interface CacheEntry {
  result: ResolvedOutboundProvider;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Resolve o provider outbound de um tracking.
 *
 * Lança:
 *  - `InstanceNotFoundError` se não existe `WhatsAppInstance` para o tracking.
 *  - `MetaCredentialsIncompleteError` se `provider=META_CLOUD` mas alguma
 *    credencial obrigatória está faltando/corrompida no banco.
 */
export async function resolveOutboundProvider(
  trackingId: string,
): Promise<ResolvedOutboundProvider> {
  const now = Date.now();
  const cached = cache.get(trackingId);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  if (cached) cache.delete(trackingId);

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      apiKey: true,
      baseUrl: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  if (!instance) {
    throw new InstanceNotFoundError(trackingId);
  }

  let result: ResolvedOutboundProvider;
  if (instance.provider === WhatsAppProvider.META_CLOUD) {
    let plain;
    try {
      plain = decryptStoredMetaCredentials({
        metaAccessToken: instance.metaAccessToken,
        metaPhoneNumberId: instance.metaPhoneNumberId,
        metaAppSecret: instance.metaAppSecret,
        metaVerifyToken: instance.metaVerifyToken,
        metaBusinessAccountId: instance.metaBusinessAccountId,
      });
    } catch (error) {
      if (error instanceof MetaCredentialsMissingError) {
        throw new MetaCredentialsIncompleteError(error.fields);
      }
      throw error;
    }
    const provider = createProvider("meta-cloud", {
      accessToken: plain.accessToken,
      phoneNumberId: plain.phoneNumberId,
      appSecret: plain.appSecret,
    });
    result = {
      provider,
      providerId: "meta-cloud",
      instanceId: instance.id,
      organizationId: instance.organizationId,
    };
  } else {
    // Default UAZAPI. Coberto também pelo schema default — qualquer enum
    // não-META cai aqui.
    const provider = createProvider("uazapi", {
      token: instance.apiKey,
      baseUrl: instance.baseUrl,
    });
    result = {
      provider,
      providerId: "uazapi",
      instanceId: instance.id,
      organizationId: instance.organizationId,
      uazapiToken: instance.apiKey,
    };
  }

  cache.set(trackingId, { result, expiresAt: now + TTL_MS });
  return result;
}

/**
 * Invalida o cache pra um tracking específico — chamar em qualquer
 * mudança de credencial/provider via `setProviderSettings` ou quando a
 * instância for recriada (novo QR code muda o `apiKey` Uazapi).
 */
export function invalidateOutboundProvider(trackingId: string): void {
  cache.delete(trackingId);
}

/**
 * Limpa o cache inteiro. Usado pelo `setProviderSettings` quando o
 * payload pode afetar QUALQUER tracking (ex.: rotacionar `AI_SECRETS_KEY`
 * fora do fluxo normal — evento raro mas operacional).
 */
export function clearOutboundProviderCache(): void {
  cache.clear();
}
