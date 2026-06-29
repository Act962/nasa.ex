import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ name: z.string() }))
  .handler(async ({ input, context }) => {
    const folder = await prisma.workspaceFolder.create({
      data: { name: input.name, organizationId: context.org.id },
    });
    return { folder };
  });
