import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const buttonSchema = z.object({
  text: z.string(),
  id: z.string(),
});

export const updateAiButtonPreset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      bodyText: z.string().optional(),
      footerText: z.string().optional().nullable(),
      buttons: z.array(buttonSchema).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { id, ...rest } = input;

    const data: Record<string, unknown> = {};
    if (rest.name !== undefined) data.name = rest.name;
    if (rest.description !== undefined) data.description = rest.description;
    if (rest.bodyText !== undefined) data.bodyText = rest.bodyText;
    if (rest.footerText !== undefined) data.footerText = rest.footerText;
    if (rest.buttons !== undefined) data.buttons = rest.buttons;
    if (rest.isActive !== undefined) data.isActive = rest.isActive;

    try {
      const preset = await prisma.aiButtonPreset.update({
        where: { id },
        data,
      });

      return { preset };
    } catch {
      throw errors.NOT_FOUND({
        message: "Preset de botões não encontrado",
      });
    }
  });
