import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";

export const connectInstanceUazapi = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new instance",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      profileName: z.string(),
      profilePicUrl: z.string(),
      instanceId: z.string(),
      owner: z.string(),
      status: z.custom<WhatsAppInstanceStatus>(),
    }),
  )

  .handler(async ({ input }) => {
    const { profileName, profilePicUrl, instanceId, owner, status } = input;
    await prisma.whatsAppInstance.update({
      where: {
        instanceId: instanceId,
      },
      data: {
        status,
        profileName,
        profilePicUrl,
        phoneNumber: owner,
      },
    });
  });
