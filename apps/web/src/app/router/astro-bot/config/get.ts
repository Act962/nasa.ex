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
        uazapiInstance: {
          select: {
            id: true,
            instanceName: true,
            phoneNumber: true,
            status: true,
            profileName: true,
          },
        },
        _count: { select: { bindings: true } },
      },
    });

    return {
      config,
      // Lista de instâncias disponíveis pra o owner escolher qual dedica
      // pro bot (separadas das de atendimento). Mostramos todas — UI
      // alerta se for instância já em uso por tracking.
      availableInstances: await prisma.whatsAppInstance.findMany({
        where: { organizationId: context.org.id },
        select: {
          id: true,
          instanceName: true,
          phoneNumber: true,
          status: true,
          trackingId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    };
  });
