import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { invalidateOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { listInstances } from "@/http/uazapi/admin/list-instances";
import { deleteInstance } from "@/http/uazapi/delete-instance";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteInstanceUazapi = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Delete a instance",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      apiKey: z.string().min(1, "Token é obrigatório"),
      baseUrl: z.string().min(1, "Base URL é obrigatório"),
      id: z.string().min(1, "ID é obrigatório"),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const adminToken = process.env.UAZAPI_TOKEN!;
      const { apiKey, baseUrl, id } = input;

      // Snapshot da instância ANTES do delete pra ter dados no log e
      // pra conseguir invalidar o cache outbound por trackingId.
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { instanceId: id },
        select: {
          id: true,
          instanceName: true,
          phoneNumber: true,
          organizationId: true,
          trackingId: true,
        },
      });

      const instances = await listInstances(adminToken);
      const hasApiKey = instances.find((key) => key.token === apiKey);
      if (hasApiKey) {
        const instanceDeleted = await deleteInstance(apiKey, baseUrl);
        if (!instanceDeleted.response) {
          throw new Error(instanceDeleted.response);
        }
      }

      await prisma.whatsAppInstance.delete({
        where: { instanceId: id },
      });

      // Invalida cache outbound (Fix #4) — sem isso, a próxima tentativa
      // de envio dentro da janela de TTL (30s) pegaria credenciais
      // zombadas e devolveria erro confuso ("instância inexistente").
      if (instance?.trackingId) {
        invalidateOutboundProvider(instance.trackingId);
      }

      if (instance?.organizationId) {
        await logActivity({
          organizationId: instance.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "tracking",
          action: "whatsapp_instance.deleted",
          actionLabel: `Deletou instância WhatsApp "${instance.instanceName ?? id}"${instance.phoneNumber ? ` (${instance.phoneNumber})` : ""}`,
          resource: instance.instanceName ?? id,
          resourceId: instance.id,
          metadata: {
            phoneNumber: instance.phoneNumber,
            uazapiInstanceId: id,
          },
        });
      }
    } catch (error) {
      console.log(error);
    }
  });
