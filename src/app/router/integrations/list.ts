import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getIntegration = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get integration",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const instances = await prisma.whatsAppInstance.findUnique({
      where: {
        trackingId: input.trackingId,
      },
      // Sem `apiKey`/`baseUrl`: são segredos e não podem trafegar pelo
      // front do chat. Quem precisa deles (fluxo de conexão de instância)
      // usa a procedure dedicada `integrations.getConnectionSecrets`.
      select: {
        id: true,
        instanceId: true,
        instanceName: true,
        profileName: true,
        status: true,
        provider: true,
        isBusiness: true,
        phoneNumber: true,
      },
    });
    return instances;
  });
