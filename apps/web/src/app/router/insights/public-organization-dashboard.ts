import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const publicOrganizationDashboard = base
  .route({
    method: "GET",
    path: "/insights/public/:organizationId/:slug",
    summary:
      "Get a public tracking dashboard report by organization and insight slug (no auth required)",
  })
  .input(
    z.object({
      organizationId: z.string(),
      slug: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const {
        organizationId,
        slug,
        startDate: inputStartDate,
        endDate: inputEndDate,
      } = input;

      // Validate the share exists and belongs to the organization
      const share = await prisma.insightShares.findUnique({
        where: {
          token: slug,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          filters: true,
          settings: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      });

      if (!share) {
        throw errors.NOT_FOUND;
      }

      // Extract filters saved on the share
      const savedFilters = (share.filters ?? {}) as {
        trackingId?: string;
        organizationIds?: string[];
        startDate?: string;
        endDate?: string;
        tagIds?: string[];
      };

      const { trackingId, organizationIds, tagIds } = savedFilters;

      const startDate = inputStartDate || savedFilters.startDate;
      const endDate = inputEndDate || savedFilters.endDate;

      const dateFilter =
        startDate || endDate
          ? {
              createdAt: {
                ...(startDate
                  ? { gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)) }
                  : {}),
                ...(endDate
                  ? {
                      lte: new Date(
                        new Date(endDate).setHours(23, 59, 59, 999),
                      ),
                    }
                  : {}),
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

      // Always scope to the organization from the share
      const organizationFilter =
        organizationIds && organizationIds.length > 0
          ? { id: { in: organizationIds } }
          : { id: organizationId };

      const baseWhere = {
        ...(trackingId ? { trackingId } : {}),
        tracking: {
          organization: {
            ...organizationFilter,
          },
        },
        ...tagFilter,
        ...dateFilter,
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
        leadsWithoutTags,
        soldThisMonthRes,
        soldLastMonthRes,
        amountThisMonthRes,
        amountLastMonthRes,
        bySource,
        byStatus,
        byResponsible,
        byTag,
        totalConversations,
        totalMessages,
        sentMessages,
        receivedMessages,
        ttfrRes,
        leadsWaiting,
        leadsActive,
      ] = await Promise.all([
        prisma.lead.count({ where: baseWhere }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "WON" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "LOST" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "ACTIVE" } }),
        prisma.lead.count({ where: { ...baseWhere, leadTags: { none: {} } } }),

        prisma.lead.aggregate({
          where: {
            ...(trackingId ? { trackingId } : {}),
            tracking: {
              organization: {
                ...organizationFilter,
              },
            },
            ...tagFilter,

            history: {
              some: {
                action: "ACTIVE",
                ...(dateFilter ? { createdAt: dateFilter.createdAt } : {}),
              },
              none: {
                OR: [
                  {
                    action: "WON",
                  },
                  {
                    action: "LOST",
                  },
                  {
                    action: "DELETED",
                  },
                ],
              },
            },
          },
          _sum: { amount: true },
        }),

        prisma.lead.aggregate({
          where: {
            ...(trackingId ? { trackingId } : {}),
            tracking: {
              organization: {
                ...organizationFilter,
              },
            },

            ...tagFilter,
            history: {
              some: {
                action: "WON",
                ...(dateFilter ? { createdAt: dateFilter.createdAt } : {}),
              },
            },
          },
          _sum: { amount: true },
        }),

        // Monthly amount comparison (same as dashboard report logic)
        prisma.lead.aggregate({
          where: {
            ...baseWhere,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: { amount: true },
        }),

        prisma.lead.aggregate({
          where: {
            ...baseWhere,
            createdAt: {
              gte: startOfLastMonth,
              lte: endOfLastMonth,
            },
          },
          _sum: { amount: true },
        }),

        prisma.lead.groupBy({
          by: ["source", "trackingId"],
          where: baseWhere,
          _count: { id: true },
        }),

        prisma.lead.groupBy({
          by: ["statusId", "trackingId"],
          where: baseWhere,
          _count: { id: true },
        }),

        prisma.lead.groupBy({
          by: ["responsibleId", "currentAction", "trackingId"],
          where: baseWhere,
          _count: { id: true },
        }),

        prisma.leadTag.findMany({
          where: { lead: baseWhere },
          select: {
            tagId: true,
            lead: { select: { trackingId: true } },
          },
        }),

        prisma.conversation.count({
          where: {
            ...(trackingId ? { trackingId } : {}),
            tracking: {
              organization: { ...organizationFilter },
            },
            ...dateFilter,
          },
        }),

        prisma.message.count({
          where: {
            conversation: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: { ...organizationFilter },
              },
            },
            ...dateFilter,
          },
        }),

        prisma.message.count({
          where: {
            fromMe: true,
            conversation: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: { ...organizationFilter },
              },
            },
            ...dateFilter,
          },
        }),

        prisma.message.count({
          where: {
            fromMe: false,
            conversation: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: { ...organizationFilter },
              },
            },
            ...dateFilter,
          },
        }),

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
            WHERE t."organization_id" = ${organizationId}
              ${trackingId ? Prisma.sql`AND c."tracking_id" = ${trackingId}` : Prisma.empty}
              ${startDate ? Prisma.sql`AND m."created_at" >= ${new Date(startDate)}` : Prisma.empty}
              ${endDate ? Prisma.sql`AND m."created_at" <= ${new Date(endDate)}` : Prisma.empty}
            GROUP BY m."conversationId"
          ) AS first_msgs
          WHERE first_inbound IS NOT NULL 
            AND first_outbound IS NOT NULL 
            AND first_outbound > first_inbound
        `,

        prisma.lead.count({ where: { ...baseWhere, statusFlow: "WAITING" } }),
        prisma.lead.count({ where: { ...baseWhere, statusFlow: "ACTIVE" } }),
      ]);

      const soldActiveRes = Number(soldThisMonthRes._sum.amount || 0);
      const soldWinnerRes = Number(soldLastMonthRes._sum.amount || 0);
      const amountThisMonth = Number(amountThisMonthRes._sum.amount || 0);
      const amountLastMonth = Number(amountLastMonthRes._sum.amount || 0);

      const [statuses, trackings] = await Promise.all([
        prisma.status.findMany({
          where: {
            ...(trackingId
              ? { trackingId }
              : {
                  tracking: {
                    organization: { ...organizationFilter },
                  },
                }),
          },
          select: { id: true, name: true, color: true },
        }),
        prisma.tracking.findMany({
          where: {
            organization: { ...organizationFilter },
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

      // Consolidate by status
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

      // Consolidate by channel
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

      // Consolidate by responsible
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

      // Consolidate by tag
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

      const monthGrowth =
        amountLastMonth > 0
          ? parseFloat(
              (
                ((amountThisMonth - amountLastMonth) / amountLastMonth) *
                100
              ).toFixed(2),
            )
          : null;

      return {
        share: {
          name: share.name,
          settings: share.settings,
          appliedFilters: {
            startDate,
            endDate,
          },
        },
        organization: share.organization,
        summary: {
          totalLeads,
          activeLeads,
          wonLeads,
          lostLeads,
          leadsWithoutTags,
          conversionRate:
            totalLeads > 0
              ? parseFloat(((wonLeads / totalLeads) * 100).toFixed(2))
              : 0,
          soldActiveRes: soldActiveRes / 100,
          soldWinnerRes: soldWinnerRes / 100,
          monthGrowthRate: monthGrowth,
          totalConversations,
          totalMessages,
          sentMessages,
          receivedMessages,
          leadsWaiting,
          leadsActive,
          avgTimeToFirstResponse: ttfrRes?.[0]?.avg_ttfr
            ? Math.round(Number(ttfrRes[0].avg_ttfr))
            : null,
        },
        byStatus: Object.entries(statusConsolidated).map(([id, val]) => ({
          status: statusMap[id] ?? { id, name: "Unknown", color: null },
          count: val.count,
          leadIds: [],
          breakdown: Object.entries(val.breakdown).map(([name, count]) => ({
            name,
            count,
            leadIds: [],
          })),
        })),
        byChannel: Object.entries(channelConsolidated).map(([source, val]) => ({
          source,
          count: val.count,
          leadIds: [],
          breakdown: Object.entries(val.breakdown).map(([name, count]) => ({
            name,
            count,
            leadIds: [],
          })),
        })),
        byAttendant: Object.entries(responsibleConsolidated).map(
          ([key, val]) => ({
            responsible: val.user,
            isUnassigned: key === "__unassigned__",
            total: val.total,
            won: val.won,
            leadIds: [],
            breakdown: Object.entries(val.breakdown).map(([name, bVal]) => ({
              name,
              count: bVal.total,
              won: bVal.won,
              leadIds: [],
            })),
          }),
        ),
        topTags: topTagIds.map((id) => ({
          tag: tagMap[id] ?? { id, name: "Unknown", color: null },
          count: tagConsolidated[id].count,
          leadIds: [],
          breakdown: Object.entries(tagConsolidated[id].breakdown).map(
            ([name, count]) => ({ name, count, leadIds: [] }),
          ),
        })),
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
