import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

export const createColumn = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a column",
    tags: ["Column"],
  })
  .input(
    z.object({
      name: z.string(),
      color: z.string().optional(),
      workspaceId: z.string(),
    }),
  )
  .output(
    z.object({
      workspaceId: z.string(),
      columnName: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const lastColumn = await prisma.workspaceColumn.findFirst({
      where: {
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "desc",
      },
    });

    let newOrder: Decimal;

    newOrder = lastColumn
      ? new Decimal(lastColumn.order).plus(1000)
      : new Decimal(1000);

    const column = await prisma.workspaceColumn.create({
      data: {
        name: input.name,
        color: input.color,
        workspaceId: input.workspaceId,
        order: newOrder,
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
        action: "workspace.column.created",
        actionLabel: `Criou a coluna "${column.name}" no workspace "${workspace.name}"`,
        resource: column.name,
        resourceId: column.id,
        metadata: { workspaceName: workspace.name },
      });
    }

    return {
      columnName: column.name,
      workspaceId: column.workspaceId,
    };
  });
