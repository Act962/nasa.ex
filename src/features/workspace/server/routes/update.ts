import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isTrackingAccessibleByUser } from "@/features/workspace/lib/tracking-link";
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
      // `null` desvincula do tracking; `undefined` mantém o vínculo atual.
      trackingId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        id: input.workspaceId,
        organizationId: context.org.id,
      },
      select: { id: true },
    });

    if (!existingWorkspace) {
      throw errors.NOT_FOUND({
        message: "Workspace não encontrado",
      });
    }

    if (input.trackingId) {
      const isAccessible = await isTrackingAccessibleByUser({
        trackingId: input.trackingId,
        organizationId: context.org.id,
        userId: context.user.id,
      });

      if (!isAccessible) {
        throw errors.FORBIDDEN({
          message: "Tracking não encontrado ou sem acesso",
        });
      }
    }

    const workspace = await prisma.workspace.update({
      where: { id: input.workspaceId },
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        coverImage: input.coverImage,
        trackingId: input.trackingId,
      },
    });

    return { workspace };
  });
