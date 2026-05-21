import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const buttonSchema = z.object({
  text: z.string(),
  id: z.string(),
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
        isActive: input.isActive,
      },
    });

    return { preset };
  });
