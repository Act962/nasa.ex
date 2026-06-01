import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
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
  .handler(async ({ input, context }) => {
    const { instanceId, status, token, baseUrl } = input;

    const result = await disconnectInstance(token, baseUrl);

    if (!result.response) {
      throw new Error(result.response);
    }

    const instance = await prisma.whatsAppInstance.update({
      where: { instanceId },
      data: { status },
      select: {
        id: true,
        instanceName: true,
        phoneNumber: true,
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
        action: "whatsapp_instance.disconnected",
        actionLabel: `Desconectou instância WhatsApp "${instance.instanceName ?? instanceId}"${instance.phoneNumber ? ` (${instance.phoneNumber})` : ""}`,
        resource: instance.instanceName ?? instanceId,
        resourceId: instance.id,
        metadata: {
          phoneNumber: instance.phoneNumber,
          newStatus: status,
        },
      });
    }
  });
