import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";

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
