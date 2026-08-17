import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/s3-client";
import { z } from "zod";

export const deleteScript = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", path: "/scripts/:id" })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const script = await prisma.script.findUnique({ where: { id: input.id } });
    if (!script) throw errors.NOT_FOUND({ message: "Script não encontrado" });

    await prisma.script.delete({ where: { id: input.id } });

    // Best-effort após o delete: script fantasma seria pior que objeto
    // órfão (spec 0004, CB-10).
    if (script.videoKey) {
      await deleteStoredObject(script.videoKey);
    }

    return { success: true };
  });
