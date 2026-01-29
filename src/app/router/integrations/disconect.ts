import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { disconnectInstance } from "@/http/uazapi/disconnect-instance";
import prisma from "@/lib/prisma";
import z from "zod";

export const disconnectInstanceUazapi = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new instance",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      instanceId: z.string(),
      status: z.custom<WhatsAppInstanceStatus>(),
      token: z.string(),
      baseUrl: z.string(),
    }),
  )

  .handler(async ({ input }) => {
    const { instanceId, status, token, baseUrl } = input;

    const result = await disconnectInstance(token, baseUrl);

    if (!result.response) {
      throw new Error(result.response);
    }

    await prisma.whatsAppInstance.update({
      where: {
        instanceId: instanceId,
      },
      data: {
        status,
      },
    });
  });
