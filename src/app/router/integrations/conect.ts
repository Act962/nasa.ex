import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
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
      isBusiness: z.boolean().optional(),
    }),
  )

  .handler(async ({ input, context }) => {
    const {
      profileName,
      profilePicUrl,
      instanceId,
      trackingId,
      owner,
      status,
      token,
      baseUrl,
      isBusiness,
    } = input;

    await configureWebhook({
      token,
      baseUrl,
      data: {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/chat/webhook?trackingId=${trackingId}`,
        enabled: true,
        events: ["messages", "connection", "labels", "chat_labels"],
        action: "update",
        excludeMessages: ["wasSentByApi", "isGroupYes"],
      },
    });
    const instance = await prisma.whatsAppInstance.update({
      where: { instanceId },
      data: {
        status,
        profileName,
        profilePicUrl,
        phoneNumber: owner,
        isBusiness,
      },
      select: {
        id: true,
        instanceName: true,
        organizationId: true,
      },
    });

    if (instance.organizationId) {
      await logActivity({
        organizationId: instance.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: "whatsapp_instance.connected",
        actionLabel: `Conectou instância WhatsApp "${profileName ?? instance.instanceName ?? instanceId}" (${owner})`,
        resource: profileName ?? instance.instanceName ?? instanceId,
        resourceId: instance.id,
        metadata: {
          phoneNumber: owner,
          trackingId,
          newStatus: status,
          isBusiness,
        },
      });
    }
  });
