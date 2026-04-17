import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateScript = base
  .use(requiredAuthMiddleware)
  .route({ method: "PATCH", path: "/scripts/:id" })
  .input(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1).optional(),
      content: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const script = await prisma.script.findUnique({ where: { id: input.id } });
    if (!script) throw errors.NOT_FOUND({ message: "Script não encontrado" });

    return await prisma.script.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.content !== undefined && { content: input.content }),
      },
    });
  });
