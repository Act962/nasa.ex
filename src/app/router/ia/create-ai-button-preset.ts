import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const buttonSchema = z.object({
  text: z.string(),
  id: z.string(),
  // tagId opcional: ao clicar no botão, o webhook aplica esta tag ao lead
  // (buttonTagMap = buttonId→tagId). Mesma semântica do modo inline.
  tagId: z.string().optional(),
});

export const createAiButtonPreset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      name: z.string().min(1, "Informe um nome para o preset"),
      description: z.string().default(""),
      bodyText: z.string().default(""),
      footerText: z.string().optional().nullable(),
      buttons: z.array(buttonSchema).default([]),
      menuFormat: z.enum(["BUTTON", "LIST"]).default("BUTTON"),
      listButton: z.string().optional().nullable(),
      isActive: z.boolean().default(true),
    }),
  )
  .handler(async ({ input }) => {
    const preset = await prisma.aiButtonPreset.create({
      data: {
        trackingId: input.trackingId,
        name: input.name,
        description: input.description,
        bodyText: input.bodyText,
        footerText: input.footerText ?? null,
        buttons: input.buttons,
        menuFormat: input.menuFormat,
        listButton: input.listButton ?? null,
        isActive: input.isActive,
      },
    });

    return { preset };
  });
