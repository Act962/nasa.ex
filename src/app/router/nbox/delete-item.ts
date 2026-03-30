import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ itemId: z.string() }))
  .handler(async ({ input, context }) => {
    await prisma.nBoxItem.delete({
      where: { id: input.itemId, organizationId: context.org.id },
    });
    return { ok: true };
  });
