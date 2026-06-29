import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateFolder = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z
        .string()
        .min(1, "Nome da pasta é obrigatório")
        .max(100, "Nome muito longo"),
    }),
  )
  .handler(async ({ input, errors }) => {
    const folder = await prisma.workflowFolder.findUnique({
      where: { id: input.id },
      select: { id: true, trackingId: true },
    });
    if (!folder) {
      throw errors.NOT_FOUND({ message: "Pasta não encontrada" });
    }

    const updated = await prisma.workflowFolder.update({
      where: { id: input.id },
      data: { name: input.name.trim() },
      select: { id: true, name: true, trackingId: true },
    });

    return updated;
  });
