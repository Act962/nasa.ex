import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const settingsSchema = z.object({
  primaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().nullable().optional(),
  trackingId: z.string().nullable().optional(),
  statusId: z.string().nullable().optional(),
  showName: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  needLogin: z.boolean().optional(),
  finishMessage: z.string().optional(),
  redirectUrl: z.string().nullable().optional(),
  idPixel: z.string().nullable().optional(),
  idTagManager: z.string().nullable().optional(),
});

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
      name: z.string().optional(),
      description: z.string().optional(),
      jsonBlock: z.string(),
      settings: settingsSchema.optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { id, name, description, jsonBlock, settings } = input;

    const form = await prisma.form.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        jsonBlock: jsonBlock as any,
        ...(settings && {
          settings: {
            update: settings,
          },
        }),
      },
      include: {
        settings: true,
      },
    });

    return {
      message: "Formulário atualizado com sucesso",
      form,
    };
  });

