import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";

/**
 * Tenancy gate do app de Campanhas. Garante que o tracking de origem pertence
 * à org e tem uma instância WhatsApp Oficial (`META_CLOUD`) — pré-requisito
 * pra qualquer campanha (o disparo real, na Fase 3, vai por esse número).
 */
export async function assertMetaCloudTracking(
  trackingId: string,
  organizationId: string,
): Promise<void> {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true },
  });
  if (!tracking) {
    throw new ORPCError("NOT_FOUND", { message: "Tracking não encontrado" });
  }

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: { provider: true, organizationId: true },
  });
  if (
    !instance ||
    instance.organizationId !== organizationId ||
    instance.provider !== WhatsAppProvider.META_CLOUD
  ) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message:
        "O tracking selecionado não tem número WhatsApp Oficial (Meta Cloud) configurado.",
    });
  }
}

export interface ResolvedCampaignMetaCredentials {
  readonly accessToken: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
}

/**
 * Resolve as credenciais Meta (WABA + token decifrado) do número Oficial de um
 * tracking, garantindo tenancy pela org. Base pros procedures de template
 * (listar/criar/upload de amostra). Lança `ORPCError` semântico em cada falha.
 */
export async function resolveCampaignMetaCredentials(
  trackingId: string,
  organizationId: string,
): Promise<ResolvedCampaignMetaCredentials> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: {
      organizationId: true,
      provider: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  if (!instance || instance.organizationId !== organizationId) {
    throw new ORPCError("NOT_FOUND", { message: "Número não encontrado" });
  }
  if (instance.provider !== WhatsAppProvider.META_CLOUD) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message:
        "O tracking selecionado não usa a API Oficial (Meta Cloud).",
    });
  }
  if (!instance.metaBusinessAccountId) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message:
        "Conta WhatsApp Business (WABA) não configurada. Reconecte a instância via Meta.",
    });
  }

  const credentials = decryptStoredMetaCredentialsPartial({
    metaAccessToken: instance.metaAccessToken,
    metaPhoneNumberId: instance.metaPhoneNumberId,
    metaAppSecret: instance.metaAppSecret,
    metaVerifyToken: instance.metaVerifyToken,
    metaBusinessAccountId: instance.metaBusinessAccountId,
  });

  return {
    accessToken: credentials.accessToken,
    wabaId: instance.metaBusinessAccountId,
    phoneNumberId: credentials.phoneNumberId,
  };
}

/**
 * Carrega um `Broadcast` garantindo que pertence à org. Retorna o registro
 * (campos escalares) — lança `NOT_FOUND` fora da org.
 */
export async function loadBroadcastForOrg(
  broadcastId: string,
  organizationId: string,
) {
  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, organizationId },
  });
  if (!broadcast) {
    throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada" });
  }
  return broadcast;
}
