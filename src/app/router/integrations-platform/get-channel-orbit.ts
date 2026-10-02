import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

/**
 * Canais que entram em órbita sem linha em `PlatformIntegration` (spec 0053, RF-12):
 * WhatsApp conta quando há instância conectada; Instagram, quando o app Comments tem a conta ativa.
 */
export const getChannelOrbit = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const [connectedWhatsAppInstances, activeInstagramChannels] = await Promise.all([
      prisma.whatsAppInstance.count({
        where: { organizationId: context.org.id, status: "CONNECTED" },
      }),
      prisma.socialChannel.count({
        where: { organizationId: context.org.id, provider: "INSTAGRAM", status: "ACTIVE" },
      }),
    ]);
    return {
      isWhatsAppConnected: connectedWhatsAppInstances > 0,
      isInstagramConnected: activeInstagramChannels > 0,
    };
  });
