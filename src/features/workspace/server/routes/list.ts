import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const listWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: context.org.id,
        members: {
          some: {
            userId: context.user.id,
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            image: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      workspaces,
    };
  });
