import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { subDays } from "date-fns";

export const getAnalytics = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const userId = context.user.id;
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    // Os KPIs são da org ativa: sem esse recorte o usuário multi-org via os
    // próprios números somados de todas as organizações no mesmo card.
    const scope = { workspace: { organizationId: context.org.id } };

    const [total, delayed, completed] = await Promise.all([
      // Total de ações não concluídas (ou todas? o usuário disse "existente")
      // Geralmente "existente" em dashboards de produtividade refere-se a tarefas ativas (não concluídas)
      prisma.action.count({
        where: {
          ...scope,
          createdBy: userId,
          isDone: false,
        },
      }),
      // Ações atrasadas (não concluídas e com data de entrega passada)
      prisma.action.count({
        where: {
          ...scope,
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
          ...scope,
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
