import "server-only";

import prisma from "@/lib/prisma";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";

export class MetaCloudInstanceNotFoundError extends Error {
  constructor(trackingId: string) {
    super(`Tracking ${trackingId} não tem instância WhatsApp Oficial (Meta Cloud) configurada.`);
    this.name = "MetaCloudInstanceNotFoundError";
  }
}

export class MetaCloudBusinessAccountMissingError extends Error {
  constructor(trackingId: string) {
    super(
      `Instância Meta Cloud do tracking ${trackingId} não tem WABA ID (metaBusinessAccountId) configurado.`,
    );
    this.name = "MetaCloudBusinessAccountMissingError";
  }
}

export interface ResolvedMetaCloudInstance {
  readonly instanceId: string;
  readonly accessToken: string;
  readonly wabaId: string;
}

/**
 * Resolve a instância Meta Cloud de uma tracking e decifra o `accessToken`
 * necessário pra chamar os endpoints de analytics da Graph API. Usa a
 * variante "partial" da decifragem — analytics só depende de
 * `accessToken`/`phoneNumberId`, presentes mesmo em instâncias provisionadas
 * via Embedded Signup (que não têm `appSecret`/`verifyToken`).
 */
export async function resolveMetaCloudInstance(
  trackingId: string,
): Promise<ResolvedMetaCloudInstance> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
  });

  if (!instance || instance.provider !== "META_CLOUD") {
    throw new MetaCloudInstanceNotFoundError(trackingId);
  }

  if (!instance.metaBusinessAccountId) {
    throw new MetaCloudBusinessAccountMissingError(trackingId);
  }

  const { accessToken } = decryptStoredMetaCredentialsPartial(instance);

  return {
    instanceId: instance.id,
    accessToken,
    wabaId: instance.metaBusinessAccountId,
  };
}
