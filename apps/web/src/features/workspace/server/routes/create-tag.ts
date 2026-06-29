import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ workspaceId: z.string(), name: z.string(), color: z.string().optional() }))
  .handler(async ({ input }) => {
    const tag = await prisma.workspaceTag.create({
      data: { workspaceId: input.workspaceId, name: input.name, color: input.color ?? "#7C3AED" },
    });
    return { tag };
  });
