import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      title: z.string().min(1, "Título é obrigatório"),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      dueDate: z.date().optional(),
      startDate: z.date().optional(),
      workspaceId: z.string().min(1, "Workspace é obrigatório"),
      columnId: z.string().min(1, "Coluna é obrigatória"),
    }),
  )
  .handler(async ({ input, context }) => {
    const firstAction = await prisma.action.findFirst({
      where: {
        columnId: input.columnId,
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
    });

    let newOrder: Prisma.Decimal;

    if (firstAction) {
      newOrder = Prisma.Decimal.sub(firstAction.order, 1);
    } else {
      newOrder = new Prisma.Decimal(0);
    }

    const action = await prisma.action.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        startDate: input.startDate,
        workspaceId: input.workspaceId,
        order: newOrder,
        columnId: input.columnId,
        createdBy: context.user.id,
        participants: {
          create: {
            userId: context.user.id,
          },
        },
      },
    });

    return {
      action,
    };
  });
