import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addWorkspaceMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      userId: z.string(),
      role: z.enum(["OWNER", "MEMBER", "VIEWER"]).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const member = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: input.userId,
        },
      },
      update: {
        role: input.role,
      },
      create: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.role ?? "MEMBER",
      },
    });

    return { member };
  });
