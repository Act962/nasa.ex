import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteColumn = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a column",
    tags: ["Column"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const columnBefore = await prisma.workspaceColumn.findUnique({
      where: { id: input.id },
      select: { name: true, workspaceId: true },
    });

    const column = await prisma.workspaceColumn.delete({
      where: {
        id: input.id,
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
        action: "workspace.column.deleted",
        actionLabel: `Excluiu a coluna "${columnBefore?.name ?? input.id}" do workspace "${workspace.name}"`,
        resource: columnBefore?.name,
        resourceId: input.id,
        metadata: { workspaceName: workspace.name },
      });
    }

    return {
      success: true,
      workspaceId: column.workspaceId,
    };
  });
