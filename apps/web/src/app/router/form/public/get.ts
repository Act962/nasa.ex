import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import type { FormSettingsTyped, WhatsappChat } from "@/features/form/types";

export const getPublic = base
  .route({
    method: "GET",
    path: "/forms/public/:id",
    summary: "Fetch a published form by its formId (public route)",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const form = await prisma.form.findUnique({
      where: {
        id: input.id,
        published: true,
      },
      include: {
        settings: true,
      },
    });

    if (!form) {
      throw new Error("Form not found");
    }

    // Substitui os campos Json do Prisma (tipo recursivo Prisma.JsonValue) por
    // tipos concretos para que o oRPC consiga inferir o retorno sem colapsar
    // para `never` no cliente.
    const typedSettings: FormSettingsTyped | null = form.settings
      ? {
          ...form.settings,
          whatsappChats: (form.settings.whatsappChats as WhatsappChat[]) ?? [],
          progressMascots: form.settings.progressMascots,
          nextButtonAction: form.settings.nextButtonAction,
        }
      : null;

    return {
      message: "Form fetched successfully",
      form: { ...form, settings: typedSettings },
    };
  });
