import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { subDays } from "date-fns";

/**
 * Lista detalhada das ações que compõem cada KPI dos cards de analytics
 * (Total / Atrasadas / Concluídas em 7 dias). Usado pelo `AnalyticsDetailsModal`.
 */
export const listAnalyticsDetails = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      bucket: z.enum(["total", "delayed", "completed"]),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    const where =
      input.bucket === "total"
        ? { createdBy: userId, isDone: false }
        : input.bucket === "delayed"
          ? { createdBy: userId, isDone: false, dueDate: { lt: now } }
          : {
              createdBy: userId,
              isDone: true,
              closedAt: { gte: sevenDaysAgo },
            };

    const actions = await prisma.action.findMany({
      where,
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: 100,
      select: {
        id: true,
        title: true,
        dueDate: true,
        isDone: true,
        priority: true,
        createdBy: true,
        workspaceId: true,
        column: { select: { id: true, name: true, color: true } },
        workspace: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, image: true, email: true } },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, image: true, email: true },
            },
          },
        },
        subActions: {
          select: { id: true, isDone: true },
        },
      },
    });

    return {
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate,
        isDone: a.isDone,
        priority: a.priority,
        isOverdue:
          !a.isDone && !!a.dueDate && new Date(a.dueDate).getTime() < now.getTime(),
        workspace: a.workspace,
        column: a.column,
        creator: a.user,
        createdBy: a.createdBy,
        participants: a.participants.map((p) => p.user),
        subActions: {
          total: a.subActions.length,
          done: a.subActions.filter((s) => s.isDone).length,
        },
      })),
    };
  });
