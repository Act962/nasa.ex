import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteScript = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", path: "/scripts/:id" })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const script = await prisma.script.findUnique({ where: { id: input.id } });
    if (!script) throw errors.NOT_FOUND({ message: "Script não encontrado" });

    await prisma.script.delete({ where: { id: input.id } });
    return { success: true };
  });
