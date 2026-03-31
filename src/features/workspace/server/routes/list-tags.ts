import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ workspaceId: z.string() }))
  .handler(async ({ input }) => {
    const tags = await prisma.workspaceTag.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return { tags };
  });
