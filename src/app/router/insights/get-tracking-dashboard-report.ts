import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const getTrackingDashboardReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/dashboard",
    summary: "Get a full consolidated report for a tracking dashboard",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      organizationIds: z.array(z.string()).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      tagIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org, user } = context;
      const { trackingId, organizationIds, startDate, endDate, tagIds } = input;

      const dateFilter =
        startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {};

      const tagFilter =
        tagIds && tagIds.length > 0
          ? {
              leadTags: {
                some: {
                  tagId: { in: tagIds },
                },
              },
            }
          : {};

      const organizationFilter = organizationIds
        ? organizationIds.length > 0
          ? { id: { in: organizationIds } }
          : {}
        : { id: org.id };

      const baseWhere = {
        ...(trackingId ? { trackingId } : {}),
        tracking: {
          organization: {
            ...organizationFilter,
            members: { some: { userId: user.id } },
          },
        },
        ...dateFilter,
        ...tagFilter,
      };

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      const [
        totalLeads,
        wonLeads,
        lostLeads,
        activeLeads,
        soldThisMonthRes,
        soldLastMonthRes,
        bySource,
        byStatus,
        byResponsible,
        byTag,
        totalConversations,
        totalMessages,
        sentMessages,
        receivedMessages,
        ttfrRes,
      ] = await Promise.all([
        prisma.lead.count({ where: baseWhere }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "WON" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "LOST" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "ACTIVE" } }),

        // Valor Vendido esse mês
        prisma.lead.aggregate({
          where: {
            ...baseWhere,
            history: {
              some: {
                action: "WON",
                createdAt: { gte: startOfMonth, lte: endOfMonth },
              },
            },
          },
          _sum: { amount: true },
        }),

        // Valor Vendido mês passado
        prisma.lead.aggregate({
          where: {
            ...baseWhere,
            history: {
              some: {
                action: "WON",
                createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
              },
            },
          },
          _sum: { amount: true },
        }),

        // Por canal
        prisma.lead.groupBy({
          by: ["source", "trackingId"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por status
        prisma.lead.groupBy({
          by: ["statusId", "trackingId"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por responsável
        prisma.lead.groupBy({
          by: ["responsibleId", "currentAction", "trackingId"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por tag
        prisma.leadTag.findMany({
          where: {
            lead: baseWhere,
          },
          select: {
            tagId: true,
            lead: {
              select: {
                trackingId: true,
              },
            },
          },
        }),

        // Conversas totais
        prisma.conversation.count({
          where: {
            ...(trackingId ? { trackingId } : {}),
            tracking: {
              organization: {
                ...organizationFilter,
                members: { some: { userId: user.id } },
              },
            },
            ...dateFilter,
          },
        }),

        // Mensagens totais
        prisma.message.count({
          where: {
            conversation: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: {
                  ...organizationFilter,
                  members: { some: { userId: user.id } },
                },
              },
            },
            ...dateFilter,
          },
        }),

        // Mensagens enviadas
        prisma.message.count({
          where: {
            fromMe: true,
            conversation: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: {
                  ...organizationFilter,
                  members: { some: { userId: user.id } },
                },
              },
            },
            ...dateFilter,
          },
        }),

        // Mensagens recebidas
        prisma.message.count({
          where: {
            fromMe: false,
            conversation: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: {
                  ...organizationFilter,
                  members: { some: { userId: user.id } },
                },
              },
            },
            ...dateFilter,
          },
        }),

        // Tempo Médio de Primeira Resposta (TTFR)
        prisma.$queryRaw<any[]>`
          SELECT 
            AVG(EXTRACT(EPOCH FROM (first_outbound - first_inbound))) as avg_ttfr
          FROM (
            SELECT 
              m."conversationId",
              MIN(CASE WHEN m."from_me" = false THEN m."created_at" END) as first_inbound,
              MIN(CASE WHEN m."from_me" = true THEN m."created_at" END) as first_outbound
            FROM "messages" m
            JOIN "conversations" c ON m."conversationId" = c."id"
            JOIN "tracking" t ON c."tracking_id" = t."id"
            JOIN "member" mem ON t."organization_id" = mem."organizationId"
            WHERE mem."userId" = ${user.id}
              ${trackingId ? Prisma.sql`AND c."tracking_id" = ${trackingId}` : Prisma.empty}
              ${
                organizationIds && organizationIds.length > 0
                  ? Prisma.sql`AND t."organization_id" IN (${Prisma.join(organizationIds)})`
                  : Prisma.sql`AND t."organization_id" = ${org.id}`
              }
              ${
                startDate
                  ? Prisma.sql`AND m."created_at" >= ${new Date(startDate)}`
                  : Prisma.empty
              }
              ${
                endDate
                  ? Prisma.sql`AND m."created_at" <= ${new Date(endDate)}`
                  : Prisma.empty
              }
            GROUP BY m."conversationId"
          ) AS first_msgs
          WHERE first_inbound IS NOT NULL 
            AND first_outbound IS NOT NULL 
            AND first_outbound > first_inbound
        `,
      ]);

      const soldThisMonth = Number(soldThisMonthRes._sum.amount || 0);
      const soldLastMonth = Number(soldLastMonthRes._sum.amount || 0);

      // Enriquecer dados
      const [statuses, trackings] = await Promise.all([
        prisma.status.findMany({
          where: {
            ...(trackingId
              ? { trackingId }
              : {
                  tracking: {
                    organization: {
                      ...organizationFilter,
                      members: { some: { userId: user.id } },
                    },
                  },
                }),
          },
          select: { id: true, name: true, color: true },
        }),
        prisma.tracking.findMany({
          where: {
            organization: {
              ...organizationFilter,
              members: { some: { userId: user.id } },
            },
          },
          select: { id: true, name: true },
        }),
      ]);

      const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));
      const trackingMap = Object.fromEntries(
        trackings.map((t) => [t.id, t.name]),
      );

      const responsibleIds = [
        ...new Set(
          byResponsible.map((r) => r.responsibleId).filter(Boolean) as string[],
        ),
      ];
      const users = await prisma.user.findMany({
        where: { id: { in: responsibleIds } },
        select: { id: true, name: true, image: true },
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      // Consolidar status com breakdown
      const statusConsolidated: Record<
        string,
        { count: number; breakdown: Record<string, number> }
      > = {};
      for (const row of byStatus) {
        if (!statusConsolidated[row.statusId]) {
          statusConsolidated[row.statusId] = { count: 0, breakdown: {} };
        }
        statusConsolidated[row.statusId].count += row._count.id;
        const tName = trackingMap[row.trackingId] || "Unknown";
        statusConsolidated[row.statusId].breakdown[tName] =
          (statusConsolidated[row.statusId].breakdown[tName] || 0) +
          row._count.id;
      }

      // Consolidar canais com breakdown
      const channelConsolidated: Record<
        string,
        { count: number; breakdown: Record<string, number> }
      > = {};
      for (const row of bySource) {
        if (!channelConsolidated[row.source]) {
          channelConsolidated[row.source] = { count: 0, breakdown: {} };
        }
        channelConsolidated[row.source].count += row._count.id;
        const tName = trackingMap[row.trackingId] || "Unknown";
        channelConsolidated[row.source].breakdown[tName] =
          (channelConsolidated[row.source].breakdown[tName] || 0) +
          row._count.id;
      }

      // Consolidar responsáveis com breakdown
      const responsibleConsolidated: Record<
        string,
        {
          user: (typeof users)[0] | null;
          won: number;
          total: number;
          breakdown: Record<string, { total: number; won: number }>;
        }
      > = {};
      for (const row of byResponsible) {
        const key = row.responsibleId ?? "__unassigned__";
        if (!responsibleConsolidated[key]) {
          responsibleConsolidated[key] = {
            user: row.responsibleId
              ? (userMap[row.responsibleId] ?? null)
              : null,
            won: 0,
            total: 0,
            breakdown: {},
          };
        }
        const tName = trackingMap[row.trackingId] || "Unknown";
        if (!responsibleConsolidated[key].breakdown[tName]) {
          responsibleConsolidated[key].breakdown[tName] = { total: 0, won: 0 };
        }

        responsibleConsolidated[key].total += row._count.id;
        responsibleConsolidated[key].breakdown[tName].total += row._count.id;

        if (row.currentAction === "WON") {
          responsibleConsolidated[key].won += row._count.id;
          responsibleConsolidated[key].breakdown[tName].won += row._count.id;
        }
      }

      // Consolidar tags com breakdown
      const tagConsolidated: Record<
        string,
        { count: number; breakdown: Record<string, number> }
      > = {};
      for (const row of byTag) {
        if (!tagConsolidated[row.tagId]) {
          tagConsolidated[row.tagId] = { count: 0, breakdown: {} };
        }
        tagConsolidated[row.tagId].count += 1;
        const tName = trackingMap[row.lead.trackingId] || "Unknown";
        tagConsolidated[row.tagId].breakdown[tName] =
          (tagConsolidated[row.tagId].breakdown[tName] || 0) + 1;
      }

      const topTagIds = Object.keys(tagConsolidated)
        .sort((a, b) => tagConsolidated[b].count - tagConsolidated[a].count)
        .slice(0, 10);

      const tags = await prisma.tag.findMany({
        where: { id: { in: topTagIds } },
        select: { id: true, name: true, color: true },
      });
      const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

      const closedTotal = wonLeads + lostLeads;
      const monthGrowth =
        soldLastMonth > 0
          ? parseFloat(
              (((soldThisMonth - soldLastMonth) / soldLastMonth) * 100).toFixed(
                2,
              ),
            )
          : null;

      return {
        summary: {
          totalLeads,
          activeLeads,
          wonLeads,
          lostLeads,
          conversionRate:
            closedTotal > 0
              ? parseFloat(((wonLeads / closedTotal) * 100).toFixed(2))
              : 0,
          soldThisMonth,
          soldLastMonth,
          monthGrowthRate: monthGrowth,
          totalConversations,
          totalMessages,
          sentMessages,
          receivedMessages,
          avgTimeToFirstResponse: ttfrRes?.[0]?.avg_ttfr
            ? Math.round(Number(ttfrRes[0].avg_ttfr))
            : null,
        },
        byStatus: Object.entries(statusConsolidated).map(([id, val]) => ({
          status: statusMap[id] ?? {
            id,
            name: "Unknown",
            color: null,
          },
          count: val.count,
          breakdown: Object.entries(val.breakdown).map(([name, count]) => ({
            name,
            count,
          })),
        })),
        byChannel: Object.entries(channelConsolidated).map(([source, val]) => ({
          source,
          count: val.count,
          breakdown: Object.entries(val.breakdown).map(([name, count]) => ({
            name,
            count,
          })),
        })),
        byAttendant: Object.entries(responsibleConsolidated).map(
          ([key, val]) => ({
            responsible: val.user,
            isUnassigned: key === "__unassigned__",
            total: val.total,
            won: val.won,
            breakdown: Object.entries(val.breakdown).map(([name, bVal]) => ({
              name,
              count: bVal.total,
              won: bVal.won,
            })),
          }),
        ),
        topTags: topTagIds.map((id) => ({
          tag: tagMap[id] ?? {
            id,
            name: "Unknown",
            color: null,
          },
          count: tagConsolidated[id].count,
          breakdown: Object.entries(tagConsolidated[id].breakdown).map(
            ([name, count]) => ({
              name,
              count,
            }),
          ),
        })),
      };

    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
