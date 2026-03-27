import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const updateForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/:id",
    summary: "Save (update) form content and metadata",
  })
  .input(
    z.object({
      id: z.string(),
      trackingId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      jsonBlock: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { id, trackingId, name, description, jsonBlock } = input;

    const form = await prisma.form.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        jsonBlock: jsonBlock as any,
        trackingId,
      },
    });

    return {
      message: "Formulário atualizado com sucesso",
      form,
    };
  });
