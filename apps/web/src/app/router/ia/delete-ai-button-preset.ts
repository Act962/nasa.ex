import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteAiButtonPreset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
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
