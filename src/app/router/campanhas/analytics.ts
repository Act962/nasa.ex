import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

/**
 * Analytics básico das campanhas da org: totais agregados (destinatários,
 * enviados, entregues, lidos, falhas), contagem por status e as campanhas
 * recentes. Sem entrada — escopo pela org do contexto.
 */
export const analytics = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const { org } = context;
    const where = { organizationId: org.id };

    const [totals, byStatus, recent] = await Promise.all([
      prisma.broadcast.aggregate({
        where,
        _count: true,
        _sum: {
          totalRecipients: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
        },
      }),
      prisma.broadcast.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          totalRecipients: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totals: {
        campaigns: totals._count,
        recipients: totals._sum.totalRecipients ?? 0,
        sent: totals._sum.sentCount ?? 0,
        delivered: totals._sum.deliveredCount ?? 0,
        read: totals._sum.readCount ?? 0,
        failed: totals._sum.failedCount ?? 0,
      },
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      recent,
    };
  });
