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
        leadsWithoutTagRaw,
        soldThisMonthRes,
        soldLastMonthRes,
        allLeadsData,
        _unusedStatus,
        _unusedResponsible,
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

        // Leads sem tag
        prisma.lead.findMany({ where: { ...baseWhere, leadTags: { none: {} } }, select: { id: true } }),

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

        // Por canal, status e responsável consolidados
        prisma.lead.findMany({
          where: baseWhere,
          select: { id: true, source: true, statusId: true, responsibleId: true, currentAction: true, trackingId: true },
        }),

        // Placeholders para manter os índices do array
        Promise.resolve(null),
        Promise.resolve(null),

        // Por tag
        prisma.leadTag.findMany({
          where: {
            lead: baseWhere,
          },
          select: {
            tagId: true,
            lead: {
              select: {
                id: true,
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

      const leadsWithoutTag = leadsWithoutTagRaw.length;

      const responsibleIds = [
        ...new Set(
          allLeadsData.map((r) => r.responsibleId).filter(Boolean) as string[],
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
        { count: number; breakdown: Record<string, { count: number; leadIds: string[] }>; leadIds: string[] }
      > = {};

      // Consolidar canais com breakdown
      const channelConsolidated: Record<
        string,
        { count: number; breakdown: Record<string, { count: number; leadIds: string[] }>; leadIds: string[] }
      > = {};

      // Consolidar responsáveis com breakdown
      const responsibleConsolidated: Record<
        string,
        {
          user: (typeof users)[0] | null;
          won: number;
          total: number;
          leadIds: string[];
          breakdown: Record<string, { total: number; won: number; leadIds: string[] }>;
        }
      > = {};

      for (const lead of allLeadsData) {
        // Status
        if (lead.statusId) {
          if (!statusConsolidated[lead.statusId]) {
            statusConsolidated[lead.statusId] = { count: 0, breakdown: {}, leadIds: [] };
          }
          statusConsolidated[lead.statusId].count += 1;
          statusConsolidated[lead.statusId].leadIds.push(lead.id);

          const tName = trackingMap[lead.trackingId] || "Unknown";
          if (!statusConsolidated[lead.statusId].breakdown[tName]) {
            statusConsolidated[lead.statusId].breakdown[tName] = { count: 0, leadIds: [] };
          }
          statusConsolidated[lead.statusId].breakdown[tName].count += 1;
          statusConsolidated[lead.statusId].breakdown[tName].leadIds.push(lead.id);
        }

        // Channel
        if (lead.source) {
          if (!channelConsolidated[lead.source]) {
            channelConsolidated[lead.source] = { count: 0, breakdown: {}, leadIds: [] };
          }
          channelConsolidated[lead.source].count += 1;
          channelConsolidated[lead.source].leadIds.push(lead.id);

          const tName = trackingMap[lead.trackingId] || "Unknown";
          if (!channelConsolidated[lead.source].breakdown[tName]) {
            channelConsolidated[lead.source].breakdown[tName] = { count: 0, leadIds: [] };
          }
          channelConsolidated[lead.source].breakdown[tName].count += 1;
          channelConsolidated[lead.source].breakdown[tName].leadIds.push(lead.id);
        }

        // Responsible
        const key = lead.responsibleId ?? "__unassigned__";
        if (!responsibleConsolidated[key]) {
             responsibleConsolidated[key] = {
               user: lead.responsibleId ? (userMap[lead.responsibleId] ?? null) : null,
               won: 0,
               total: 0,
               leadIds: [],
               breakdown: {},
             };
        }
        const tName = trackingMap[lead.trackingId] || "Unknown";
        if (!responsibleConsolidated[key].breakdown[tName]) {
          responsibleConsolidated[key].breakdown[tName] = { total: 0, won: 0, leadIds: [] };
        }

        responsibleConsolidated[key].total += 1;
        responsibleConsolidated[key].leadIds.push(lead.id);
        responsibleConsolidated[key].breakdown[tName].total += 1;
        responsibleConsolidated[key].breakdown[tName].leadIds.push(lead.id);

        if (lead.currentAction === "WON") {
          responsibleConsolidated[key].won += 1;
          responsibleConsolidated[key].breakdown[tName].won += 1;
        }
      }

      // Consolidar tags com breakdown
      const tagConsolidated: Record<
        string,
        { count: number; breakdown: Record<string, { count: number; leadIds: string[] }>; leadIds: string[] }
      > = {};
      for (const row of byTag) {
        if (!tagConsolidated[row.tagId]) {
          tagConsolidated[row.tagId] = { count: 0, breakdown: {}, leadIds: [] };
        }
        tagConsolidated[row.tagId].count += 1;
        tagConsolidated[row.tagId].leadIds.push(row.lead.id);

        const tName = trackingMap[row.lead.trackingId] || "Unknown";
        if (!tagConsolidated[row.tagId].breakdown[tName]) {
          tagConsolidated[row.tagId].breakdown[tName] = { count: 0, leadIds: [] };
        }
        tagConsolidated[row.tagId].breakdown[tName].count += 1;
        tagConsolidated[row.tagId].breakdown[tName].leadIds.push(row.lead.id);
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
          leadsWithoutTag,
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
          leadIds: val.leadIds,
          breakdown: Object.entries(val.breakdown).map(([name, bVal]) => ({
            name,
            count: bVal.count,
            leadIds: bVal.leadIds,
          })),
        })),
        byChannel: Object.entries(channelConsolidated).map(([source, val]) => ({
          source,
          count: val.count,
          leadIds: val.leadIds,
          breakdown: Object.entries(val.breakdown).map(([name, bVal]) => ({
            name,
            count: bVal.count,
            leadIds: bVal.leadIds,
          })),
        })),
        byAttendant: Object.entries(responsibleConsolidated).map(
          ([key, val]) => ({
            responsible: val.user,
            isUnassigned: key === "__unassigned__",
            total: val.total,
            won: val.won,
            leadIds: val.leadIds,
            breakdown: Object.entries(val.breakdown).map(([name, bVal]) => ({
              name,
              count: bVal.total,
              won: bVal.won,
              leadIds: bVal.leadIds,
            })),
          }),
        ),
        topTags: [
          ...topTagIds.map((id) => ({
            tag: tagMap[id] ?? {
              id,
              name: "Unknown",
              color: null,
            },
            count: tagConsolidated[id].count,
            leadIds: tagConsolidated[id].leadIds,
            breakdown: Object.entries(tagConsolidated[id].breakdown).map(
              ([name, bVal]) => ({
                name,
                count: bVal.count,
                leadIds: bVal.leadIds,
              }),
            ),
          })),
          ...(leadsWithoutTag > 0 ? [{
            tag: {
              id: "unassigned",
              name: "Sem tag",
              color: "hsl(215, 16%, 47%)",
            },
            count: leadsWithoutTag,
            leadIds: leadsWithoutTagRaw.map(l => l.id),
            breakdown: [],
          }] : []),
        ],
      };

    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
