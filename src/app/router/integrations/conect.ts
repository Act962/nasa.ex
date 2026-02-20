import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { configureWebhook } from "@/http/uazapi/configure-webhook";
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
      trackingId: z.string(),
      owner: z.string(),
      status: z.custom<WhatsAppInstanceStatus>(),
      token: z.string(),
      baseUrl: z.string(),
    }),
  )

  .handler(async ({ input }) => {
    const {
      profileName,
      profilePicUrl,
      instanceId,
      trackingId,
      owner,
      status,
      token,
      baseUrl,
    } = input;

    await configureWebhook({
      token,
      baseUrl,
      data: {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/chat/webhook?trackingId=${trackingId}`,
        enabled: true,
        events: ["messages", "connection", "labels", "chat_labels"],
        action: "add",
        excludeMessages: ["wasSentByApi", "isGroupYes"],
      },
    });
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
