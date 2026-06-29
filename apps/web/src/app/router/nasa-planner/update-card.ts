import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const updateCard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      cardId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z
        .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
        .optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      assigneeIds: z.array(z.string()).optional(),
      dueDate: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { cardId, dueDate, ...data } = input;

    // First verify ownership
    const existing = await prisma.nasaPlannerCard.findFirst({
      where: { id: cardId, mindMap: { planner: { organizationId: context.org.id } } },
    });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Card não encontrado" });

    const card = await prisma.nasaPlannerCard.update({
      where: { id: cardId },
      data: {
        ...data,
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
      },
    });

    return { card };
  });
