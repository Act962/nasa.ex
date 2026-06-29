import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getWorkspaceMembers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId },
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    return { members };
  });
