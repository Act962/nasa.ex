import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      columnId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    // Check for actions
    const hasActions = await prisma.action.findFirst({
      where: { columnId: input.columnId },
    });

    if (hasActions) {
      throw errors.FORBIDDEN({
        message:
          "Não é possível deletar uma coluna que possua tarefas vinculadas. Mova as tarefas primeiro.",
      });
    }

    const column = await prisma.workspaceColumn.delete({
      where: { id: input.columnId },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "workspace",
      subAppSlug: "workspace-columns",
      featureKey: "workspace.column.deleted",
      action: "workspace.column.deleted",
      actionLabel: `Excluiu a coluna "${column.name}" do workspace`,
      resource: column.name,
      resourceId: column.id,
      metadata: {
        workspaceId: column.workspaceId,
        color: column.color ?? undefined,
      },
    });

    return { column };
  });
