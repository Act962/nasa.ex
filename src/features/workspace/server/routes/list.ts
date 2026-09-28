import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        trackingId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ context, input }) => {
    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: context.org.id,
        members: {
          some: {
            userId: context.user.id,
          },
        },
        ...(input?.trackingId ? { trackingId: input.trackingId } : {}),
      },
      include: {
        creator: {
          select: {
            id: true,
            image: true,
            name: true,
          },
        },
        tracking: {
          select: {
            id: true,
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
