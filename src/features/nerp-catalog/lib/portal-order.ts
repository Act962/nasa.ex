import "server-only";
import prisma from "@/lib/prisma";

export async function findOrderByPublicToken(publicToken: string) {
  return prisma.catalogOrder.findUnique({
    where: { publicToken },
    include: {
      organization: { select: { name: true, logo: true } },
      lead: {
        select: {
          id: true,
          isActive: true,
          firstResponseAt: true,
          lastInboundAt: true,
          conversation: { select: { id: true, trackingId: true } },
        },
      },
    },
  });
}

// Etapa do lead no funil de logística vira o texto da linha do tempo — é o
// time da loja que decide os nomes ("Separando", "Saiu para entrega"...).
export async function resolveLogisticsStageName(order: {
  organizationId: string;
  leadId: string;
  status: string;
}): Promise<string | null> {
  if (order.status !== "IN_LOGISTICS" && order.status !== "DELIVERED") return null;
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId: order.organizationId },
    select: { logisticsTrackingId: true },
  });
  if (!integration) return null;

  const orderLead = await prisma.lead.findUnique({
    where: { id: order.leadId },
    select: { phone: true, trackingId: true, status: { select: { name: true } } },
  });
  if (!orderLead) return null;
  if (orderLead.trackingId === integration.logisticsTrackingId) return orderLead.status.name;
  if (!orderLead.phone) return null;

  const logisticsLead = await prisma.lead.findUnique({
    where: {
      phone_trackingId: { phone: orderLead.phone, trackingId: integration.logisticsTrackingId },
    },
    select: { status: { select: { name: true } } },
  });
  return logisticsLead?.status.name ?? null;
}
