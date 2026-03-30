import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getItems = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    folderId: z.string().nullable().optional(),
    search: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const items = await prisma.nBoxItem.findMany({
      where: {
        organizationId: context.org.id,
        folderId: input.folderId === undefined ? undefined : input.folderId,
        ...(input.search ? {
          name: { contains: input.search, mode: "insensitive" },
        } : {}),
      },
      include: { createdBy: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  });
