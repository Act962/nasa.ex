import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const getWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ workspaceId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: input.workspaceId,
        organizationId: context.org.id,
      },
    });

    if (!workspace) {
      throw errors.NOT_FOUND({
        message: "Workspace não encontrado",
      });
    }

    return { workspace };
  });
