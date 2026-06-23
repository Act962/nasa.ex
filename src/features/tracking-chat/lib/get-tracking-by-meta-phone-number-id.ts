import "server-only";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import {
  decryptStoredMetaCredentialsPartial,
  MetaCredentialsMissingError,
} from "./providers/meta-credentials";

/**
 * Resolve o mapeamento `phone_number_id → WhatsAppInstance` usado pelo
 * webhook oficial da Meta (`/api/chat/webhook/official`).
 *
 * **Lookup direto.** `metaPhoneNumberId` é `@unique` e plaintext no schema
 * (é um identificador público — aparece em todo webhook Meta e na URL de
 * envio do Graph). `findUnique` resolve em sub-ms via índice; sem cache,
 * sem scan, sem decrypt loop.
 *
 * Decifragem custa apenas pelos 3 segredos reais (`accessToken`,
 * `appSecret`, `verifyToken`) da row encontrada.
 */

export interface ResolvedMetaInstance {
  readonly instanceId: string;
  readonly trackingId: string;
  readonly organizationId: string;
  readonly accessToken: string;
  readonly phoneNumberId: string;
  /**
   * `null` quando a instância foi provisionada via Embedded Signup (Fase 7) —
   * o caller deve cair pro `META_APP_SECRET` global. Continuar com `null`
   * sem fallback é um erro de configuração e o webhook responde 401.
   */
  readonly appSecret: string | null;
  /** `null` em instâncias Embedded Signup — caller cai pro `META_VERIFY_TOKEN_GLOBAL`. */
  readonly verifyToken: string | null;
  readonly businessAccountId: string | null;
}

/**
 * Retorna `null` quando:
 *  - Não existe instância `META_CLOUD` com esse `phone_number_id`, OU
 *  - A instância existe mas credenciais essenciais estão ausentes/corrompidas.
 */
export async function getTrackingByMetaPhoneNumberId(
  phoneNumberId: string,
): Promise<ResolvedMetaInstance | null> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { metaPhoneNumberId: phoneNumberId },
    select: {
      id: true,
      provider: true,
      trackingId: true,
      organizationId: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  if (!instance || instance.provider !== WhatsAppProvider.META_CLOUD) {
    return null;
  }

  try {
    const plain = decryptStoredMetaCredentialsPartial({
      metaAccessToken: instance.metaAccessToken,
      metaPhoneNumberId: instance.metaPhoneNumberId,
      metaAppSecret: instance.metaAppSecret,
      metaVerifyToken: instance.metaVerifyToken,
      metaBusinessAccountId: instance.metaBusinessAccountId,
    });
    return {
      instanceId: instance.id,
      trackingId: instance.trackingId,
      organizationId: instance.organizationId,
      accessToken: plain.accessToken,
      phoneNumberId: plain.phoneNumberId,
      appSecret: plain.appSecret,
      verifyToken: plain.verifyToken,
      businessAccountId: plain.businessAccountId,
    };
  } catch (error) {
    if (error instanceof MetaCredentialsMissingError) {
      // Instância existe mas operador não terminou de configurar
      // credenciais essenciais (accessToken). Webhook responde 401 (config).
      return null;
    }
    // Provavelmente `AI_SECRETS_KEY` rotacionou sem re-encriptar essa
    // instância. Loga (operador vai querer saber) e devolve null.
    console.error(
      "[meta-phone-lookup] decrypt_failed",
      { instanceId: instance.id },
      error,
    );
    return null;
  }
}
