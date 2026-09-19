import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const unlinkSeiProcess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ linkId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await prisma.seiProcessLink.deleteMany({
      where: { id: input.linkId, organizationId: context.org.id },
    });
    return { ok: true };
  });
