import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ folderId: z.string() }))
  .handler(async ({ input, context }) => {
    await prisma.nBoxFolder.delete({
      where: { id: input.folderId, organizationId: context.org.id },
    });
    return { ok: true };
  });
