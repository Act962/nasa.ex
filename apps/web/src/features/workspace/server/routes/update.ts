import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      coverImage: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const workspace = await prisma.workspace.update({
      where: { id: input.workspaceId },
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        coverImage: input.coverImage,
      },
    });

    return { workspace };
  });
