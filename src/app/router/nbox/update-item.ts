import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    itemId: z.string(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    folderId: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  }))
  .handler(async ({ input, context }) => {
    const item = await prisma.nBoxItem.update({
      where: { id: input.itemId, organizationId: context.org.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.folderId !== undefined && { folderId: input.folderId }),
        ...(input.tags !== undefined && { tags: input.tags }),
      },
    });
    return { item };
  });
