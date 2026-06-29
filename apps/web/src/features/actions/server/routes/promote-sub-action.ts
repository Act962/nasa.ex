import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const promoteSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const subAction = await prisma.subActions.findUniqueOrThrow({
      where: { id: input.subActionId },
      include: {
        action: {
          select: {
            id: true,
            workspaceId: true,
            columnId: true,
            dueDate: true,
            startDate: true,
            trackingId: true,
            organizationId: true,
          },
        },
      },
    });

    // Find the first action in the column to set a new order (place before it)
    const firstAction = await prisma.action.findFirst({
      where: { columnId: subAction.action.columnId },
      orderBy: { order: "asc" },
    });

    const newOrder = firstAction
      ? Prisma.Decimal.sub(firstAction.order, 1)
      : new Prisma.Decimal(0);

    const [newAction] = await prisma.$transaction([
      prisma.action.create({
        data: {
          title: subAction.title,
          description: subAction.description,
          dueDate: subAction.finishDate ?? subAction.action.dueDate,
          workspaceId: subAction.action.workspaceId,
          columnId: subAction.action.columnId,
          trackingId: subAction.action.trackingId,
          organizationId: subAction.action.organizationId,
          createdBy: context.user.id,
          order: newOrder,
          participants: {
            create: { userId: context.user.id },
          },
        },
      }),
      prisma.subActions.delete({ where: { id: input.subActionId } }),
    ]);

    return { action: newAction, parentActionId: subAction.action.id };
  });
