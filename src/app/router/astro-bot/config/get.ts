import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getBotConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const config = await prisma.organizationBotConfig.findUnique({
      where: { organizationId: context.org.id },
      include: {
        enabledTrackings: { select: { trackingId: true } },
        _count: { select: { bindings: true } },
      },
    });

    // Trackings da org disponíveis pra habilitar — o Astro responde pelo
    // número da própria tracking, usando o provider ATIVO dela (Uazapi/Meta).
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: context.org.id, isArchived: false },
      select: {
        id: true,
        name: true,
        whatsappInstance: {
          select: { provider: true, phoneNumber: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      config: config
        ? {
            ...config,
            enabledTrackingIds: config.enabledTrackings.map(
              (enabled) => enabled.trackingId,
            ),
          }
        : null,
      availableTrackings: trackings,
    };
  });
