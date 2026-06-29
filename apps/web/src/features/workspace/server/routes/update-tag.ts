import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ tagId: z.string(), name: z.string().optional(), color: z.string().optional() }))
  .handler(async ({ input }) => {
    const { tagId, ...data } = input;
    const tag = await prisma.workspaceTag.update({ where: { id: tagId }, data });
    return { tag };
  });
