import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";

/**
 * Lista os trackings da org que têm instância WhatsApp Oficial (`META_CLOUD`)
 * — alimenta o seletor de número de origem ao criar uma campanha.
 */
export const listSendingNumbers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const { org } = context;

    const instances = await prisma.whatsAppInstance.findMany({
      where: {
        organizationId: org.id,
        provider: WhatsAppProvider.META_CLOUD,
      },
      select: {
        trackingId: true,
        phoneNumber: true,
        profileName: true,
        status: true,
        tracking: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return instances.map((instance) => ({
      trackingId: instance.trackingId,
      trackingName: instance.tracking.name,
      phoneNumber: instance.phoneNumber,
      profileName: instance.profileName,
      status: instance.status,
    }));
  });
