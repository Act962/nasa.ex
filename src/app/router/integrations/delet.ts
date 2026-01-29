import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
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
    const { apiKey, baseUrl, id } = input;

    const instance = await deleteInstance(apiKey, baseUrl);

    if (!instance.response) {
      throw new Error(instance.response);
    }

    await prisma.whatsAppInstance.delete({
      where: {
        instanceId: id,
      },
    });
  });
