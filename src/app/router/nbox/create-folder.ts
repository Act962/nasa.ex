import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createFolder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    name: z.string().min(1).max(100),
    parentId: z.string().optional(),
    color: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const folder = await prisma.nBoxFolder.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
        color: input.color ?? null,
        organizationId: context.org.id,
        createdById: context.user.id,
      },
    });
    return { folder };
  });
