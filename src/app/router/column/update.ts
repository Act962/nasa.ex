import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateColumn = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    summary: "Update a column",
    tags: ["Column"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const column = await prisma.workspaceColumn.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        color: input.color,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    const workspace = await prisma.workspace.findUnique({
      where: { id: column.workspaceId },
      select: { name: true, organizationId: true },
    });

    if (workspace) {
      await logActivity({
        organizationId: workspace.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "explorer",
        action: "workspace.column.updated",
        actionLabel: `Atualizou a coluna no workspace "${workspace.name}"`,
        resourceId: column.id,
        metadata: { workspaceName: workspace.name, name: input.name },
      });
    }

    return {
      success: true,
      workspaceId: column.workspaceId,
    };
  });
