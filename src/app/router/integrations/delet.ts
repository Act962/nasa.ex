import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { listInstances } from "@/http/uazapi/admin/list-instances";
import { deleteInstance } from "@/http/uazapi/delete-instance";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
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
      const instances = await listInstances(adminToken);

      const hasApiKey = instances.find((key) => key.token === apiKey);
      if (hasApiKey) {
        const instanceDeleted = await deleteInstance(apiKey, baseUrl);
        if (!instanceDeleted.response) {
          throw new Error(instanceDeleted.response);
        }
      }

      await prisma.whatsAppInstance.delete({
        where: {
          instanceId: id,
        },
      });
    } catch (error) {
      console.log(error);
    }
  });
