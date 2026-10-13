import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { canAccessMenu } from "./button-preset-access";
import z from "zod";

export const deleteAiButtonPreset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canAccessMenu(input.id, context.user.id))) {
      throw errors.NOT_FOUND({ message: "Preset de botões não encontrado" });
    }
    try {
      await prisma.aiButtonPreset.delete({
        where: { id: input.id },
      });

      return { ok: true };
    } catch {
      throw errors.NOT_FOUND({
        message: "Preset de botões não encontrado",
      });
    }
  });
