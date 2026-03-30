import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { subDays } from "date-fns";

export const getAnalytics = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const userId = context.user.id;
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    const [total, delayed, completed] = await Promise.all([
      // Total de ações não concluídas (ou todas? o usuário disse "existente")
      // Geralmente "existente" em dashboards de produtividade refere-se a tarefas ativas (não concluídas)
      prisma.action.count({
        where: {
          createdBy: userId,
          isDone: false,
        },
      }),
      // Ações atrasadas (não concluídas e com data de entrega passada)
      prisma.action.count({
        where: {
          createdBy: userId,
          isDone: false,
          dueDate: {
            lt: now,
          },
        },
      }),
      // Ações concluídas nos últimos 7 dias
      prisma.action.count({
        where: {
          createdBy: userId,
          isDone: true,
          closedAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      total,
      delayed,
      completed,
    };
  });
