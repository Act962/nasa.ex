import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { getTagSnapshotAtDate } from "@/features/insights/lib/tag-snapshot";

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
      memberIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org, user } = context;
      const {
        trackingId,
        organizationIds,
        startDate,
        endDate,
        tagIds,
        memberIds,
      } = input;

      // Filtro de atendentes — aplicado nas queries de Lead (Tracking/Geral)
      // E nas de Conversation/Message/TTFR/sentReminders (Atendimento).
      const hasMembers = !!memberIds && memberIds.length > 0;
      const memberLeadFilter = hasMembers
        ? { responsibleId: { in: memberIds } }
        : {};

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
        ...tagFilter,
        ...dateFilter,
        ...memberLeadFilter,
      };

      const [
        totalLeads,
        wonLeads,
        lostLeads,
        activeLeads,
        leadsWithoutTagRaw,
        soldActiveRes,
        soldWinnerRes,
        allLeadsData,
        _unusedStatus,
        _unusedResponsible,
        byTag,
        totalConversations,
        totalMessages,
        sentMessages,
        receivedMessages,
        ttfrRes,
        leadsWaiting,
        leadsActive,
        sentReminders,
      ] = await Promise.all([
        prisma.lead.count({ where: baseWhere }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "WON" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "LOST" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "ACTIVE" } }),

        // Leads sem tag
        prisma.lead.findMany({
          where: { ...baseWhere, leadTags: { none: {} } },
          select: { id: true },
        }),

        // Valor de leads ativos
        prisma.lead.aggregate({
          where: {
            ...(trackingId ? { trackingId } : {}),
            tracking: {
              organization: {
                ...organizationFilter,
                members: { some: { userId: user.id } },
              },
            },
            ...tagFilter,
            ...memberLeadFilter,
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

        // Valor valor de leads vendidos
        prisma.lead.aggregate({
          where: {
            ...(trackingId ? { trackingId } : {}),
            tracking: {
              organization: {
                ...organizationFilter,
                members: { some: { userId: user.id } },
              },
            },
            ...tagFilter,
            ...memberLeadFilter,
            history: {
              some: {
                action: "WON",
                ...dateFilter,
              },
            },
          },
          _sum: { amount: true },
        }),

        // Por canal, status e responsável consolidados
        prisma.lead.findMany({
          where: baseWhere,
          select: {
            id: true,
            source: true,
            statusId: true,
            responsibleId: true,
            currentAction: true,
            trackingId: true,
          },
        }),

        // Placeholders para manter os índices do array
        Promise.resolve(null),
        Promise.resolve(null),

        // Por tag — usa SNAPSHOT TEMPORAL ao invés de LeadTag vivo.
        //
        // **Lead scope SEM filtro de createdAt**: pra analytics de tag, o
        // que importa é "quais leads TINHAM a tag em endDate", não "quais
        // leads foram CRIADOS no período". Lead criado em maio que pegou
        // a tag em 27.05 deve aparecer no filtro "27.05".
        //
        // Reconstrói snapshot via LeadJourneyEvent (tag_added/tag_removed)
        // + fallback de LeadTag.createdAt. Sem isso, remover tag HOJE
        // fazia métrica de ONTEM cair retroativamente.
        prisma.lead
          .findMany({
            // Filtro de tag NÃO inclui dateFilter — só org/tracking/members.
            // Se baseWhere mudar de shape, ajustar aqui pra manter alinhado.
            where: {
              ...(trackingId ? { trackingId } : {}),
              tracking: {
                organization: {
                  ...organizationFilter,
                  members: { some: { userId: user.id } },
                },
              },
              ...(hasMembers ? memberLeadFilter : {}),
              ...tagFilter,
            },
            select: { id: true, trackingId: true },
          })
          .then(async (leads) => {
            const leadById = new Map(leads.map((l) => [l.id, l]));
            const snapshot = await getTagSnapshotAtDate(
              leads.map((l) => l.id),
              endDate ? new Date(endDate) : null,
            );
            return snapshot
              .map((s) => {
                const lead = leadById.get(s.leadId);
                if (!lead) return null;
                return {
                  tagId: s.tagId,
                  lead: { id: lead.id, trackingId: lead.trackingId },
                };
              })
              .filter((r): r is NonNullable<typeof r> => r !== null);
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
            ...(hasMembers ? { lead: memberLeadFilter } : {}),
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
              ...(hasMembers ? { lead: memberLeadFilter } : {}),
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
              ...(hasMembers ? { lead: memberLeadFilter } : {}),
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
              ...(hasMembers ? { lead: memberLeadFilter } : {}),
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
            ${hasMembers ? Prisma.sql`JOIN "leads" l ON c."lead_id" = l."id"` : Prisma.empty}
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
              ${
                tagIds && tagIds.length > 0
                  ? Prisma.sql`AND EXISTS (SELECT 1 FROM "lead_tags" lt WHERE lt."lead_id" = c."lead_id" AND lt."tag_id" IN (${Prisma.join(tagIds)}))`
                  : Prisma.empty
              }
              ${
                hasMembers
                  ? Prisma.sql`AND l."responsible_id" IN (${Prisma.join(memberIds!)})`
                  : Prisma.empty
              }
            GROUP BY m."conversationId"
          ) AS first_msgs
          WHERE first_inbound IS NOT NULL
            AND first_outbound IS NOT NULL
            AND first_outbound > first_inbound
        `,

        // Leads aguardando atendimento (WAITING) — baseWhere já carrega
        // memberLeadFilter quando aplicável.
        prisma.lead.count({
          where: { ...baseWhere, statusFlow: "WAITING" },
        }),

        // Leads em atendimento (ACTIVE)
        prisma.lead.count({
          where: { ...baseWhere, statusFlow: "ACTIVE" },
        }),

        // Lembretes enviados (ReminderOccurrence com sent=true) no período.
        // Quando memberIds está setado, restringe o OR às branches que têm
        // ligação com lead/conversation (e portanto com responsável). As
        // branches "tracking-only" e "action" são descartadas pois não têm
        // conceito de responsável.
        prisma.reminderOccurrence.count({
          where: {
            sent: true,
            ...(startDate || endDate
              ? {
                  sentAt: {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate) } : {}),
                  },
                }
              : {}),
            reminder: {
              OR: hasMembers
                ? [
                    {
                      lead: {
                        ...memberLeadFilter,
                        tracking: {
                          organization: {
                            ...organizationFilter,
                            members: { some: { userId: user.id } },
                          },
                          ...(trackingId ? { id: trackingId } : {}),
                        },
                      },
                    },
                    {
                      conversation: {
                        lead: memberLeadFilter,
                        tracking: {
                          organization: {
                            ...organizationFilter,
                            members: { some: { userId: user.id } },
                          },
                          ...(trackingId ? { id: trackingId } : {}),
                        },
                      },
                    },
                  ]
                : [
                    {
                      tracking: {
                        organization: {
                          ...organizationFilter,
                          members: { some: { userId: user.id } },
                        },
                        ...(trackingId ? { id: trackingId } : {}),
                      },
                    },
                    {
                      lead: {
                        tracking: {
                          organization: {
                            ...organizationFilter,
                            members: { some: { userId: user.id } },
                          },
                          ...(trackingId ? { id: trackingId } : {}),
                        },
                      },
                    },
                    {
                      conversation: {
                        tracking: {
                          organization: {
                            ...organizationFilter,
                            members: { some: { userId: user.id } },
                          },
                          ...(trackingId ? { id: trackingId } : {}),
                        },
                      },
                    },
                    {
                      action: {
                        organization: {
                          ...organizationFilter,
                          members: { some: { userId: user.id } },
                        },
                      },
                    },
                  ],
            },
          },
        }),
      ]);

      const soldThisMonth = Number(soldActiveRes._sum.amount || 0);
      const soldLastMonth = Number(soldWinnerRes._sum.amount || 0);

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const previousMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const previousMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      const baseWhereForAmountGrowth = {
        ...(trackingId ? { trackingId } : {}),
        tracking: {
          organization: {
            ...organizationFilter,
            members: { some: { userId: user.id } },
          },
        },
        ...tagFilter,
        ...memberLeadFilter,
      };

      const [amountThisMonthRes, amountLastMonthRes] = await Promise.all([
        prisma.lead.aggregate({
          where: {
            ...baseWhereForAmountGrowth,
            createdAt: {
              gte: currentMonthStart,
              lte: currentMonthEnd,
            },
          },
          _sum: { amount: true },
        }),
        prisma.lead.aggregate({
          where: {
            ...baseWhereForAmountGrowth,
            createdAt: {
              gte: previousMonthStart,
              lte: previousMonthEnd,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const amountThisMonth = Number(amountThisMonthRes._sum.amount || 0);
      const amountLastMonth = Number(amountLastMonthRes._sum.amount || 0);

      const monthGrowth =
        amountLastMonth > 0
          ? parseFloat(
              (
                ((amountThisMonth - amountLastMonth) / amountLastMonth) *
                100
              ).toFixed(2),
            )
          : null;

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
        {
          count: number;
          breakdown: Record<string, { count: number; leadIds: string[] }>;
          leadIds: string[];
        }
      > = {};

      // Consolidar canais com breakdown
      const channelConsolidated: Record<
        string,
        {
          count: number;
          breakdown: Record<string, { count: number; leadIds: string[] }>;
          leadIds: string[];
        }
      > = {};

      // Consolidar responsáveis com breakdown
      const responsibleConsolidated: Record<
        string,
        {
          user: (typeof users)[0] | null;
          won: number;
          total: number;
          leadIds: string[];
          breakdown: Record<
            string,
            { total: number; won: number; leadIds: string[] }
          >;
        }
      > = {};

      for (const lead of allLeadsData) {
        // Status
        if (lead.statusId) {
          if (!statusConsolidated[lead.statusId]) {
            statusConsolidated[lead.statusId] = {
              count: 0,
              breakdown: {},
              leadIds: [],
            };
          }
          statusConsolidated[lead.statusId].count += 1;
          statusConsolidated[lead.statusId].leadIds.push(lead.id);

          const tName = trackingMap[lead.trackingId] || "Unknown";
          if (!statusConsolidated[lead.statusId].breakdown[tName]) {
            statusConsolidated[lead.statusId].breakdown[tName] = {
              count: 0,
              leadIds: [],
            };
          }
          statusConsolidated[lead.statusId].breakdown[tName].count += 1;
          statusConsolidated[lead.statusId].breakdown[tName].leadIds.push(
            lead.id,
          );
        }

        // Channel
        if (lead.source) {
          if (!channelConsolidated[lead.source]) {
            channelConsolidated[lead.source] = {
              count: 0,
              breakdown: {},
              leadIds: [],
            };
          }
          channelConsolidated[lead.source].count += 1;
          channelConsolidated[lead.source].leadIds.push(lead.id);

          const tName = trackingMap[lead.trackingId] || "Unknown";
          if (!channelConsolidated[lead.source].breakdown[tName]) {
            channelConsolidated[lead.source].breakdown[tName] = {
              count: 0,
              leadIds: [],
            };
          }
          channelConsolidated[lead.source].breakdown[tName].count += 1;
          channelConsolidated[lead.source].breakdown[tName].leadIds.push(
            lead.id,
          );
        }

        // Responsible
        const key = lead.responsibleId ?? "__unassigned__";
        if (!responsibleConsolidated[key]) {
          responsibleConsolidated[key] = {
            user: lead.responsibleId
              ? (userMap[lead.responsibleId] ?? null)
              : null,
            won: 0,
            total: 0,
            leadIds: [],
            breakdown: {},
          };
        }
        const tName = trackingMap[lead.trackingId] || "Unknown";
        if (!responsibleConsolidated[key].breakdown[tName]) {
          responsibleConsolidated[key].breakdown[tName] = {
            total: 0,
            won: 0,
            leadIds: [],
          };
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
        {
          count: number;
          breakdown: Record<string, { count: number; leadIds: string[] }>;
          leadIds: string[];
        }
      > = {};
      for (const row of byTag) {
        if (!tagConsolidated[row.tagId]) {
          tagConsolidated[row.tagId] = { count: 0, breakdown: {}, leadIds: [] };
        }
        tagConsolidated[row.tagId].count += 1;
        tagConsolidated[row.tagId].leadIds.push(row.lead.id);

        const tName = trackingMap[row.lead.trackingId] || "Unknown";
        if (!tagConsolidated[row.tagId].breakdown[tName]) {
          tagConsolidated[row.tagId].breakdown[tName] = {
            count: 0,
            leadIds: [],
          };
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

      return {
        summary: {
          totalLeads,
          activeLeads,
          wonLeads,
          lostLeads,
          conversionRate:
            totalLeads > 0
              ? parseFloat(((wonLeads / totalLeads) * 100).toFixed(2))
              : 0,
          leadsWithoutTag,
          soldActiveRes: soldThisMonth / 100,
          soldWinnerRes: soldLastMonth / 100,
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
          sentReminders,
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
          ...(leadsWithoutTag > 0
            ? [
                {
                  tag: {
                    id: "unassigned",
                    name: "Sem tag",
                    color: "hsl(215, 16%, 47%)",
                  },
                  count: leadsWithoutTag,
                  leadIds: leadsWithoutTagRaw.map((l) => l.id),
                  breakdown: [],
                },
              ]
            : []),
        ],
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
