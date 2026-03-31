import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      columnId: z.string().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      isDone: z.boolean().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { actionId, ...data } = input;

    const action = await prisma.action.update({
      where: { id: actionId },
      data: {
        ...data,
        closedAt: data.isDone === true ? new Date() : data.isDone === false ? null : undefined,
      },
    });

    return { action };
  });
