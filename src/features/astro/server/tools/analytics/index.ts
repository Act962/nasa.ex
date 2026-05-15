import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { userBelongsToOrg } from "@/features/astro/server/tools/_shared/permissions";

/**
 * Tools de ANALYTICS pro Astro responder perguntas sobre indicadores
 * de cada app do NASA (leitura, agregação, comparação).
 *
 * Convenção:
 * - Todas aceitam filtros padrão: { fromIso, toIso, orgIds?, userIds? }.
 *   Default: últimos 30 dias, todas as orgs do user, todos os users.
 * - Permissão: user só lê dados das orgs em que é member.
 *   Member sem role "admin/owner" só vê dados próprios (segurança).
 *
 * 🚨 ESTRATÉGIA INCREMENTAL: esta é a primeira leva (atividade +
 * tracking overview). Próximas adições por área conforme plano:
 * chat, workspace, forms, agenda, forge, nasa-route, linnker, nbox,
 * financeiro, integrações, space-help.
 */
export function buildAnalyticsTools(ctx: AgentContext) {
  return {
    get_org_activity_summary: tool({
      description:
        "Resume a atividade da organização no período: tempo ativo (sec), space points acumulados, stars consumidos, ações totais, top users e top apps. Use quando o usuário perguntar 'como tá a atividade', 'o que aconteceu essa semana', 'quem mais usou', etc.",
      inputSchema: z.object({
        fromIso: z
          .string()
          .optional()
          .describe(
            "Início do período (ISO 8601). Default: 30 dias atrás",
          ),
        toIso: z
          .string()
          .optional()
          .describe("Fim do período (ISO 8601). Default: agora"),
        orgIds: z
          .array(z.string())
          .optional()
          .describe("Filtra orgs específicas. Default: todas as orgs do user"),
        userIds: z
          .array(z.string())
          .optional()
          .describe("Filtra users específicos. Default: todos da org"),
        appSlugs: z
          .array(z.string())
          .optional()
          .describe(
            "Filtra apps específicos (tracking, forge, spacetime, etc)",
          ),
      }),
      execute: async ({ fromIso, toIso, orgIds, userIds, appSlugs }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        // Member sem privilégio só vê próprios dados
        const isMemberOnly = memberships.every((m) => m.role === "member");
        const userFilter = isMemberOnly ? [ctx.userId] : userIds;

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const baseWhere = {
          organizationId: { in: targetOrgs },
          createdAt: { gte: from, lte: to },
          ...(userFilter && userFilter.length > 0
            ? { userId: { in: userFilter } }
            : {}),
          ...(appSlugs && appSlugs.length > 0
            ? { appSlug: { in: appSlugs } }
            : {}),
        };

        const [activities, presence, starsTransactions, spTransactions] =
          await Promise.all([
            prisma.systemActivityLog.findMany({
              where: baseWhere,
              select: { userId: true, userName: true, appSlug: true },
              take: 5000,
            }),
            prisma.userSessionRollup.findMany({
              where: {
                organizationId: { in: targetOrgs },
                ...(userFilter && userFilter.length > 0
                  ? { userId: { in: userFilter } }
                  : {}),
                day: { gte: from, lte: to },
              },
              select: {
                userId: true,
                totalActiveSec: true,
                totalOnlineSec: true,
              },
            }),
            prisma.starTransaction.findMany({
              where: {
                organizationId: { in: targetOrgs },
                type: "APP_CHARGE",
                createdAt: { gte: from, lte: to },
                ...(userFilter && userFilter.length > 0
                  ? { userId: { in: userFilter } }
                  : {}),
              },
              select: { amount: true },
            }),
            prisma.spacePointTransaction.findMany({
              where: {
                orgId: { in: targetOrgs },
                createdAt: { gte: from, lte: to },
                ...(userFilter && userFilter.length > 0
                  ? { userPoint: { userId: { in: userFilter } } }
                  : {}),
              },
              select: { points: true },
            }),
          ]);

        // Agrega por user
        const byUserMap = new Map<string, { name: string; actions: number }>();
        for (const a of activities) {
          if (!a.userId) continue;
          const entry = byUserMap.get(a.userId) ?? {
            name: a.userName ?? "—",
            actions: 0,
          };
          entry.actions++;
          byUserMap.set(a.userId, entry);
        }
        const topUsers = [...byUserMap.entries()]
          .map(([id, v]) => ({ userId: id, name: v.name, actions: v.actions }))
          .sort((a, b) => b.actions - a.actions)
          .slice(0, 5);

        // Agrega por app
        const byAppMap = new Map<string, number>();
        for (const a of activities) {
          const k = a.appSlug ?? "outros";
          byAppMap.set(k, (byAppMap.get(k) ?? 0) + 1);
        }
        const topApps = [...byAppMap.entries()]
          .map(([app, actions]) => ({ app, actions }))
          .sort((a, b) => b.actions - a.actions)
          .slice(0, 6);

        const totalActiveSec = presence.reduce(
          (sum, p) => sum + p.totalActiveSec,
          0,
        );
        const totalOnlineSec = presence.reduce(
          (sum, p) => sum + p.totalOnlineSec,
          0,
        );
        const starsConsumed = starsTransactions.reduce(
          (sum, t) => sum + Math.abs(t.amount),
          0,
        );
        const spacePointsEarned = spTransactions.reduce(
          (sum, t) => sum + (t.points > 0 ? t.points : 0),
          0,
        );

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          orgs: targetOrgs.length,
          totalActions: activities.length,
          totalActiveSeconds: totalActiveSec,
          totalActiveHours: Math.round((totalActiveSec / 3600) * 10) / 10,
          totalOnlineSeconds: totalOnlineSec,
          totalOnlineHours: Math.round((totalOnlineSec / 3600) * 10) / 10,
          totalInactiveHours:
            Math.round(((totalOnlineSec - totalActiveSec) / 3600) * 10) / 10,
          spacePointsEarned,
          starsConsumed,
          topUsers,
          topApps,
        };
      },
    }),

    get_tracking_overview: tool({
      description:
        "Resume métricas de TRACKING (CRM): quantidade de trackings, leads por status (ativo/ganho/perdido), taxa de conversão, valor total em pipeline, top tags, crescimento mensal. Use quando perguntar 'como tá a venda', 'quantos leads novos', 'qual a conversão', etc.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        trackingIds: z
          .array(z.string())
          .optional()
          .describe("Filtra trackings específicos"),
        tagIds: z.array(z.string()).optional(),
        responsibleIds: z
          .array(z.string())
          .optional()
          .describe("Filtra leads atribuídos a esses users"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        trackingIds,
        tagIds,
        responsibleIds,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }
        if (!(await userBelongsToOrg(ctx.userId, targetOrgs[0]!))) {
          return { error: "Sem acesso" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        // Trackings da org
        const trackings = await prisma.tracking.findMany({
          where: {
            organizationId: { in: targetOrgs },
            ...(trackingIds && trackingIds.length > 0
              ? { id: { in: trackingIds } }
              : {}),
          },
          select: { id: true, name: true, organizationId: true },
        });
        const trackingIdSet = trackings.map((t) => t.id);

        const leadWhere = {
          trackingId: { in: trackingIdSet },
          ...(responsibleIds && responsibleIds.length > 0
            ? { responsibleId: { in: responsibleIds } }
            : {}),
          ...(tagIds && tagIds.length > 0
            ? { leadTags: { some: { tagId: { in: tagIds } } } }
            : {}),
        };

        const [totalLeads, leadsInPeriod, won, lost, active, leadsWithAmount] =
          await Promise.all([
            prisma.lead.count({ where: leadWhere }),
            prisma.lead.count({
              where: { ...leadWhere, createdAt: { gte: from, lte: to } },
            }),
            prisma.lead.count({
              where: { ...leadWhere, currentAction: "WON" },
            }),
            prisma.lead.count({
              where: { ...leadWhere, currentAction: "LOST" },
            }),
            prisma.lead.count({
              where: { ...leadWhere, currentAction: "ACTIVE", isActive: true },
            }),
            prisma.lead.findMany({
              where: { ...leadWhere, currentAction: "ACTIVE", isActive: true },
              select: { amount: true },
            }),
          ]);

        const pipelineValue = leadsWithAmount.reduce(
          (sum, l) => sum + Number(l.amount ?? 0),
          0,
        );
        const conversionRate =
          totalLeads > 0 ? Math.round((won / totalLeads) * 100 * 10) / 10 : 0;

        // Leads por tracking
        const byTracking = await Promise.all(
          trackings.map(async (t) => {
            const [count, activeCount, wonCount] = await Promise.all([
              prisma.lead.count({ where: { ...leadWhere, trackingId: t.id } }),
              prisma.lead.count({
                where: {
                  ...leadWhere,
                  trackingId: t.id,
                  currentAction: "ACTIVE",
                  isActive: true,
                },
              }),
              prisma.lead.count({
                where: {
                  ...leadWhere,
                  trackingId: t.id,
                  currentAction: "WON",
                },
              }),
            ]);
            return {
              trackingId: t.id,
              name: t.name,
              total: count,
              active: activeCount,
              won: wonCount,
            };
          }),
        );

        // Top tags (5 mais usadas em leads ativos)
        const topTags = await prisma.tag.findMany({
          where: {
            organizationId: { in: targetOrgs },
          },
          select: {
            id: true,
            name: true,
            color: true,
            _count: { select: { leadTags: true } },
          },
          orderBy: { leadTags: { _count: "desc" } },
          take: 5,
        });

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          trackings: trackings.length,
          leads: {
            total: totalLeads,
            inPeriod: leadsInPeriod,
            active: active,
            won,
            lost,
            conversionRate,
          },
          pipelineValueBRL: pipelineValue,
          byTracking: byTracking.sort((a, b) => b.total - a.total),
          topTags: topTags.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            leadCount: t._count.leadTags,
          })),
        };
      },
    }),

    // ── CHAT (conversas, mensagens, TTFR, lembretes) ────────────────────
    get_chat_metrics: tool({
      description:
        "Resume métricas de CHAT: total de conversas (ativas/inativas), mensagens enviadas vs recebidas, tempo médio de primeira resposta (TTFR), lembretes enviados. Use quando o usuário perguntar 'quantas conversas', 'quantas mensagens', 'tempo de resposta', 'quantos lembretes', etc.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
        responsibleIds: z.array(z.string()).optional(),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        trackingIds,
        responsibleIds,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        // Trackings filtrados
        const trackingsAll = await prisma.tracking.findMany({
          where: {
            organizationId: { in: targetOrgs },
            ...(trackingIds && trackingIds.length > 0
              ? { id: { in: trackingIds } }
              : {}),
          },
          select: { id: true },
        });
        const tIds = trackingsAll.map((t) => t.id);
        if (tIds.length === 0) {
          return { error: "Nenhum tracking encontrado nas orgs alvo" };
        }

        // Filtro de lead.responsibleId opcional
        const convWhere = {
          trackingId: { in: tIds },
          ...(responsibleIds && responsibleIds.length > 0
            ? { lead: { responsibleId: { in: responsibleIds } } }
            : {}),
        };

        const [
          totalConversations,
          activeConversations,
          newConversationsInPeriod,
          sentMessages,
          receivedMessages,
          remindersSent,
          remindersActive,
          convsWithFirstUserMsg,
        ] = await Promise.all([
          prisma.conversation.count({ where: convWhere }),
          prisma.conversation.count({
            where: { ...convWhere, isActive: true },
          }),
          prisma.conversation.count({
            where: { ...convWhere, createdAt: { gte: from, lte: to } },
          }),
          prisma.message.count({
            where: {
              conversation: convWhere,
              fromMe: true,
              createdAt: { gte: from, lte: to },
            },
          }),
          prisma.message.count({
            where: {
              conversation: convWhere,
              fromMe: false,
              createdAt: { gte: from, lte: to },
            },
          }),
          // Reminders enviados (ocorrências realmente disparadas)
          prisma.reminderOccurrence.count({
            where: {
              sent: true,
              sentAt: { gte: from, lte: to },
              reminder: {
                ...(responsibleIds && responsibleIds.length > 0
                  ? { createdByUserId: { in: responsibleIds } }
                  : {}),
                OR: [
                  { trackingId: { in: tIds } },
                  { conversation: convWhere },
                ],
              },
            },
          }),
          prisma.reminder.count({
            where: {
              isActive: true,
              ...(responsibleIds && responsibleIds.length > 0
                ? { createdByUserId: { in: responsibleIds } }
                : {}),
              OR: [
                { trackingId: { in: tIds } },
                { conversation: convWhere },
              ],
            },
          }),
          // Pra TTFR: pega conversas com firstUserMessageAt no período
          prisma.conversation.findMany({
            where: {
              ...convWhere,
              firstUserMessageAt: { gte: from, lte: to, not: null },
            },
            select: { createdAt: true, firstUserMessageAt: true },
            take: 500,
          }),
        ]);

        // TTFR aproximado: avg(firstUserMessageAt - conversation.createdAt)
        const ttfrSecondsList = convsWithFirstUserMsg
          .filter((c) => c.firstUserMessageAt)
          .map(
            (c) =>
              (c.firstUserMessageAt!.getTime() - c.createdAt.getTime()) / 1000,
          )
          .filter((s) => s >= 0);
        const ttfrAvgSeconds =
          ttfrSecondsList.length > 0
            ? Math.round(
                ttfrSecondsList.reduce((a, b) => a + b, 0) /
                  ttfrSecondsList.length,
              )
            : null;
        const ttfrAvgMinutes =
          ttfrAvgSeconds !== null ? Math.round(ttfrAvgSeconds / 60) : null;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          conversations: {
            total: totalConversations,
            active: activeConversations,
            newInPeriod: newConversationsInPeriod,
          },
          messages: {
            sent: sentMessages,
            received: receivedMessages,
            total: sentMessages + receivedMessages,
          },
          reminders: {
            sentInPeriod: remindersSent,
            activeNow: remindersActive,
          },
          ttfrAvgSeconds,
          ttfrAvgMinutes,
        };
      },
    }),

    // ── FORGE (propostas, receita, ticket médio) ─────────────────────────
    get_forge_metrics: tool({
      description:
        "Resume métricas de FORGE (propostas comerciais): total/rascunho/enviadas/visualizadas/pagas/expiradas/canceladas, receita total fechada (PAGAS), receita em pipeline (ENVIADAS+VISUALIZADAS), ticket médio, desconto médio, tempo médio até pagamento. Use quando o usuário perguntar sobre vendas, propostas, receita, valor.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        responsibleIds: z.array(z.string()).optional(),
        leadIds: z
          .array(z.string())
          .optional()
          .describe("Filtra propostas de leads específicos"),
      }),
      execute: async ({ fromIso, toIso, orgIds, responsibleIds, leadIds }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const baseWhere = {
          organizationId: { in: targetOrgs },
          ...(responsibleIds && responsibleIds.length > 0
            ? { responsibleId: { in: responsibleIds } }
            : {}),
          ...(leadIds && leadIds.length > 0
            ? { clientId: { in: leadIds } }
            : {}),
        };

        const [
          totalProposals,
          inPeriod,
          rascunho,
          enviadas,
          visualizadas,
          pagas,
          expiradas,
          canceladas,
          proposalsForRevenue,
          proposalsPagasNoPeriodo,
        ] = await Promise.all([
          prisma.forgeProposal.count({ where: baseWhere }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, createdAt: { gte: from, lte: to } },
          }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, status: "RASCUNHO" },
          }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, status: "ENVIADA" },
          }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, status: "VISUALIZADA" },
          }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, status: "PAGA" },
          }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, status: "EXPIRADA" },
          }),
          prisma.forgeProposal.count({
            where: { ...baseWhere, status: "CANCELADA" },
          }),
          // Pra calcular receita + ticket — busca propostas com produtos
          prisma.forgeProposal.findMany({
            where: {
              ...baseWhere,
              status: { in: ["PAGA", "ENVIADA", "VISUALIZADA"] },
              createdAt: { gte: from, lte: to },
            },
            select: {
              status: true,
              discount: true,
              discountType: true,
              products: { select: { quantity: true, unitValue: true } },
              createdAt: true,
              updatedAt: true,
            },
            take: 1000,
          }),
          prisma.forgeProposal.findMany({
            where: {
              ...baseWhere,
              status: "PAGA",
              updatedAt: { gte: from, lte: to },
            },
            select: { createdAt: true, updatedAt: true },
            take: 500,
          }),
        ]);

        // Calcula valor de cada proposta
        const calcValue = (p: {
          discount: { toString(): string } | null;
          discountType: "PERCENTUAL" | "FIXO" | null;
          products: { quantity: { toString(): string }; unitValue: { toString(): string } }[];
        }) => {
          const subtotal = p.products.reduce(
            (s, x) => s + Number(x.quantity) * Number(x.unitValue),
            0,
          );
          if (!p.discount) return subtotal;
          const disc = Number(p.discount);
          if (p.discountType === "PERCENTUAL")
            return subtotal * (1 - disc / 100);
          return Math.max(0, subtotal - disc);
        };

        const pagasValues = proposalsForRevenue
          .filter((p) => p.status === "PAGA")
          .map(calcValue);
        const pipelineValues = proposalsForRevenue
          .filter((p) => p.status === "ENVIADA" || p.status === "VISUALIZADA")
          .map(calcValue);

        const revenueClosed = pagasValues.reduce((a, b) => a + b, 0);
        const revenuePipeline = pipelineValues.reduce((a, b) => a + b, 0);
        const avgTicket =
          pagasValues.length > 0
            ? Math.round((revenueClosed / pagasValues.length) * 100) / 100
            : 0;

        // Tempo médio até pagamento (em dias)
        const timeToPayDays = proposalsPagasNoPeriodo
          .map(
            (p) =>
              (p.updatedAt.getTime() - p.createdAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
          .filter((d) => d >= 0);
        const avgTimeToPayDays =
          timeToPayDays.length > 0
            ? Math.round(
                (timeToPayDays.reduce((a, b) => a + b, 0) /
                  timeToPayDays.length) *
                  10,
              ) / 10
            : null;

        // Desconto médio (das propostas com desconto)
        const discountValues = proposalsForRevenue
          .filter((p) => p.discount && Number(p.discount) > 0)
          .map((p) => Number(p.discount));
        const avgDiscount =
          discountValues.length > 0
            ? Math.round(
                (discountValues.reduce((a, b) => a + b, 0) /
                  discountValues.length) *
                  100,
              ) / 100
            : 0;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          proposals: {
            total: totalProposals,
            inPeriod,
            byStatus: {
              rascunho,
              enviadas,
              visualizadas,
              pagas,
              expiradas,
              canceladas,
            },
          },
          revenue: {
            closedBRL: Math.round(revenueClosed * 100) / 100,
            pipelineBRL: Math.round(revenuePipeline * 100) / 100,
          },
          avgTicketBRL: avgTicket,
          avgDiscount,
          avgTimeToPayDays,
        };
      },
    }),

    // ── WORKSPACE (actions: abertas/concluídas/atrasadas) ────────────────
    get_workspace_metrics: tool({
      description:
        "Resume métricas de WORKSPACE: quantidade de workspaces, total de actions (concluídas/abertas/atrasadas), por prioridade. Use quando perguntar sobre tarefas, atrasadas, workspaces.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        workspaceIds: z.array(z.string()).optional(),
        participantIds: z
          .array(z.string())
          .optional()
          .describe("Users que são responsáveis ou participantes da action"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        workspaceIds,
        participantIds,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();
        const now = new Date();

        const actionWhere = {
          organizationId: { in: targetOrgs },
          isArchived: false,
          ...(workspaceIds && workspaceIds.length > 0
            ? { workspaceId: { in: workspaceIds } }
            : {}),
          ...(participantIds && participantIds.length > 0
            ? {
                OR: [
                  { responsibles: { some: { userId: { in: participantIds } } } },
                  { participants: { some: { userId: { in: participantIds } } } },
                  { createdBy: { in: participantIds } },
                ],
              }
            : {}),
        };

        const [
          workspaces,
          totalActions,
          actionsInPeriod,
          doneActions,
          openActions,
          overdueActions,
          highPriority,
          urgentPriority,
        ] = await Promise.all([
          prisma.workspace.count({
            where: {
              organizationId: { in: targetOrgs },
              isArchived: false,
              ...(workspaceIds && workspaceIds.length > 0
                ? { id: { in: workspaceIds } }
                : {}),
            },
          }),
          prisma.action.count({ where: actionWhere }),
          prisma.action.count({
            where: { ...actionWhere, createdAt: { gte: from, lte: to } },
          }),
          prisma.action.count({
            where: { ...actionWhere, isDone: true },
          }),
          prisma.action.count({
            where: { ...actionWhere, isDone: false },
          }),
          prisma.action.count({
            where: {
              ...actionWhere,
              isDone: false,
              dueDate: { lt: now },
            },
          }),
          prisma.action.count({
            where: { ...actionWhere, priority: "HIGH", isDone: false },
          }),
          prisma.action.count({
            where: { ...actionWhere, priority: "URGENT", isDone: false },
          }),
        ]);

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          workspaces,
          actions: {
            total: totalActions,
            inPeriod: actionsInPeriod,
            done: doneActions,
            open: openActions,
            overdue: overdueActions,
            byPriority: {
              urgent: urgentPriority,
              high: highPriority,
            },
          },
        };
      },
    }),

    // ── AGENDA / SPACETIME (appointments por status, no-show) ────────────
    get_agenda_metrics: tool({
      description:
        "Resume métricas de AGENDA (spacetime/agendamentos): total/no período, por status (pendente/confirmado/realizado/cancelado/no-show), taxa de no-show, taxa de comparecimento. Use quando perguntar sobre agenda, reuniões, agendamentos, faltas.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        agendaIds: z
          .array(z.string())
          .optional()
          .describe("Filtra agendas específicas"),
        participantIds: z
          .array(z.string())
          .optional()
          .describe("Users responsáveis pelo appointment"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        agendaIds,
        participantIds,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const apptWhere = {
          agenda: {
            organizationId: { in: targetOrgs },
            ...(agendaIds && agendaIds.length > 0
              ? { id: { in: agendaIds } }
              : {}),
          },
          ...(participantIds && participantIds.length > 0
            ? { userId: { in: participantIds } }
            : {}),
        };

        const [
          totalAgendas,
          totalAppointments,
          inPeriod,
          pending,
          confirmed,
          done,
          cancelled,
          noShow,
        ] = await Promise.all([
          prisma.agenda.count({
            where: {
              organizationId: { in: targetOrgs },
              ...(agendaIds && agendaIds.length > 0
                ? { id: { in: agendaIds } }
                : {}),
            },
          }),
          prisma.appointment.count({ where: apptWhere }),
          prisma.appointment.count({
            where: { ...apptWhere, startsAt: { gte: from, lte: to } },
          }),
          prisma.appointment.count({
            where: { ...apptWhere, status: "PENDING" },
          }),
          prisma.appointment.count({
            where: { ...apptWhere, status: "CONFIRMED" },
          }),
          prisma.appointment.count({
            where: { ...apptWhere, status: "DONE" },
          }),
          prisma.appointment.count({
            where: { ...apptWhere, status: "CANCELLED" },
          }),
          prisma.appointment.count({
            where: { ...apptWhere, status: "NO_SHOW" },
          }),
        ]);

        const concluded = done + noShow; // realmente teve data passada
        const noShowRate =
          concluded > 0
            ? Math.round((noShow / concluded) * 100 * 10) / 10
            : 0;
        const attendanceRate =
          concluded > 0
            ? Math.round((done / concluded) * 100 * 10) / 10
            : 0;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          agendas: totalAgendas,
          appointments: {
            total: totalAppointments,
            inPeriod,
            byStatus: {
              pending,
              confirmed,
              done,
              cancelled,
              noShow,
            },
          },
          noShowRate,
          attendanceRate,
        };
      },
    }),

    // ── FORMS (formulários: submissões, conversão, abandono) ─────────────
    get_forms_metrics: tool({
      description:
        "Resume métricas de FORMS (formulários): total de formulários publicados/rascunho, submissões completas vs abandonadas, taxa de conversão pra lead, top forms por volume. Use quando o user perguntar sobre formulários, submissões, leads via form, taxa de abandono.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        formIds: z
          .array(z.string())
          .optional()
          .describe("Filtra forms específicos"),
      }),
      execute: async ({ fromIso, toIso, orgIds, formIds }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const formWhere = {
          organizationId: { in: targetOrgs },
          ...(formIds && formIds.length > 0 ? { id: { in: formIds } } : {}),
        };

        const responseWhere = {
          form: {
            organizationId: { in: targetOrgs },
            ...(formIds && formIds.length > 0 ? { id: { in: formIds } } : {}),
          },
        };

        const [
          totalForms,
          publishedForms,
          totalResponses,
          completedInPeriod,
          abandonedInPeriod,
          responsesWithLead,
          topForms,
        ] = await Promise.all([
          prisma.form.count({ where: formWhere }),
          prisma.form.count({ where: { ...formWhere, published: true } }),
          prisma.formResponses.count({ where: responseWhere }),
          prisma.formResponses.count({
            where: {
              ...responseWhere,
              completedAt: { gte: from, lte: to, not: null },
            },
          }),
          prisma.formResponses.count({
            where: {
              ...responseWhere,
              createdAt: { gte: from, lte: to },
              completedAt: null,
            },
          }),
          prisma.formResponses.count({
            where: {
              ...responseWhere,
              completedAt: { gte: from, lte: to, not: null },
              leadId: { not: null },
            },
          }),
          prisma.form.findMany({
            where: formWhere,
            select: {
              id: true,
              name: true,
              published: true,
              views: true,
              responses: true,
              _count: { select: { formSubmissions: true } },
            },
            orderBy: { responses: "desc" },
            take: 5,
          }),
        ]);

        const conversionToLeadRate =
          completedInPeriod > 0
            ? Math.round((responsesWithLead / completedInPeriod) * 100 * 10) /
              10
            : 0;
        const totalInPeriod = completedInPeriod + abandonedInPeriod;
        const abandonRate =
          totalInPeriod > 0
            ? Math.round((abandonedInPeriod / totalInPeriod) * 100 * 10) / 10
            : 0;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          forms: {
            total: totalForms,
            published: publishedForms,
            draft: totalForms - publishedForms,
          },
          responses: {
            total: totalResponses,
            completedInPeriod,
            abandonedInPeriod,
            convertedToLead: responsesWithLead,
            conversionToLeadRate,
            abandonRate,
          },
          topForms: topForms.map((f) => ({
            id: f.id,
            name: f.name,
            published: f.published,
            views: f.views,
            responses: f.responses,
          })),
        };
      },
    }),

    // ── NASA ROUTE (cursos, matrículas, certificados, receita Stars) ────
    get_route_metrics: tool({
      description:
        "Resume métricas de NASA ROUTE (cursos): total de cursos publicados/rascunho, matrículas ativas vs reembolsadas, certificados emitidos, receita em Stars (paidStars), top cursos por alunos. Use quando o user perguntar sobre cursos, alunos, certificados, receita de cursos.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        courseIds: z.array(z.string()).optional(),
      }),
      execute: async ({ fromIso, toIso, orgIds, courseIds }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const courseWhere = {
          creatorOrgId: { in: targetOrgs },
          ...(courseIds && courseIds.length > 0
            ? { id: { in: courseIds } }
            : {}),
        };

        const enrollmentWhere = {
          course: courseWhere,
        };

        const [
          totalCourses,
          publishedCourses,
          totalEnrollments,
          enrollmentsInPeriod,
          activeEnrollments,
          refundedEnrollments,
          completedEnrollments,
          certificatesIssued,
          revenueAgg,
          topCourses,
        ] = await Promise.all([
          prisma.nasaRouteCourse.count({ where: courseWhere }),
          prisma.nasaRouteCourse.count({
            where: { ...courseWhere, isPublished: true },
          }),
          prisma.nasaRouteEnrollment.count({ where: enrollmentWhere }),
          prisma.nasaRouteEnrollment.count({
            where: {
              ...enrollmentWhere,
              enrolledAt: { gte: from, lte: to },
            },
          }),
          prisma.nasaRouteEnrollment.count({
            where: { ...enrollmentWhere, status: "active" },
          }),
          prisma.nasaRouteEnrollment.count({
            where: { ...enrollmentWhere, status: "refunded" },
          }),
          prisma.nasaRouteEnrollment.count({
            where: { ...enrollmentWhere, completedAt: { not: null } },
          }),
          prisma.nasaRouteCertificate.count({
            where: {
              enrollment: enrollmentWhere,
            },
          }),
          prisma.nasaRouteEnrollment.aggregate({
            where: {
              ...enrollmentWhere,
              enrolledAt: { gte: from, lte: to },
            },
            _sum: { paidStars: true },
          }),
          prisma.nasaRouteCourse.findMany({
            where: courseWhere,
            select: {
              id: true,
              title: true,
              format: true,
              isPublished: true,
              studentsCount: true,
              priceStars: true,
              _count: { select: { enrollments: true } },
            },
            orderBy: { studentsCount: "desc" },
            take: 5,
          }),
        ]);

        const completionRate =
          totalEnrollments > 0
            ? Math.round(
                (completedEnrollments / totalEnrollments) * 100 * 10,
              ) / 10
            : 0;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          courses: {
            total: totalCourses,
            published: publishedCourses,
            draft: totalCourses - publishedCourses,
          },
          enrollments: {
            total: totalEnrollments,
            inPeriod: enrollmentsInPeriod,
            active: activeEnrollments,
            refunded: refundedEnrollments,
            completed: completedEnrollments,
            completionRate,
          },
          certificatesIssued,
          revenueStarsInPeriod: revenueAgg._sum.paidStars ?? 0,
          topCourses: topCourses.map((c) => ({
            id: c.id,
            title: c.title,
            format: c.format,
            published: c.isPublished,
            students: c.studentsCount,
            priceStars: c.priceStars,
            totalEnrollments: c._count.enrollments,
          })),
        };
      },
    }),

    // ── LINNKER / NASA PAGE (landing pages, visitas) ─────────────────────
    get_linnker_metrics: tool({
      description:
        "Resume métricas de LINNKER (NasaPage / landing pages): total publicadas/rascunho/arquivadas, total de visitas, visitas no período, top páginas por visitas. Use quando o user perguntar sobre landing pages, páginas públicas, visitas, bio link.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        pageIds: z.array(z.string()).optional(),
      }),
      execute: async ({ fromIso, toIso, orgIds, pageIds }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const pageWhere = {
          organizationId: { in: targetOrgs },
          ...(pageIds && pageIds.length > 0 ? { id: { in: pageIds } } : {}),
        };

        const [
          totalPages,
          publishedPages,
          archivedPages,
          totalVisits,
          visitsInPeriod,
          topPages,
        ] = await Promise.all([
          prisma.nasaPage.count({ where: pageWhere }),
          prisma.nasaPage.count({
            where: { ...pageWhere, status: "PUBLISHED" },
          }),
          prisma.nasaPage.count({
            where: { ...pageWhere, status: "ARCHIVED" },
          }),
          prisma.nasaPageVisit.count({
            where: { page: pageWhere },
          }),
          prisma.nasaPageVisit.count({
            where: {
              page: pageWhere,
              createdAt: { gte: from, lte: to },
            },
          }),
          prisma.nasaPage.findMany({
            where: pageWhere,
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              customDomain: true,
              _count: { select: { visits: true } },
            },
            orderBy: { visits: { _count: "desc" } },
            take: 5,
          }),
        ]);

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          pages: {
            total: totalPages,
            published: publishedPages,
            draft: totalPages - publishedPages - archivedPages,
            archived: archivedPages,
          },
          visits: {
            total: totalVisits,
            inPeriod: visitsInPeriod,
          },
          topPages: topPages.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            status: p.status,
            customDomain: p.customDomain,
            visits: p._count.visits,
          })),
        };
      },
    }),

    // ── NBOX (storage: folders, items, size, tipos) ──────────────────────
    get_nbox_metrics: tool({
      description:
        "Resume métricas de NBOX (storage): total de pastas, itens por tipo (arquivo/imagem/link/contrato/proposta), tamanho total armazenado, itens públicos compartilháveis. Use quando o user perguntar sobre storage, arquivos, itens compartilhados, NBox.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
      }),
      execute: async ({ fromIso, toIso, orgIds }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const baseOrg = { organizationId: { in: targetOrgs } };

        const [
          folders,
          totalItems,
          itemsInPeriod,
          fileItems,
          imageItems,
          linkItems,
          contractItems,
          proposalItems,
          publicItems,
          sizeAgg,
        ] = await Promise.all([
          prisma.nBoxFolder.count({ where: baseOrg }),
          prisma.nBoxItem.count({ where: baseOrg }),
          prisma.nBoxItem.count({
            where: { ...baseOrg, createdAt: { gte: from, lte: to } },
          }),
          prisma.nBoxItem.count({ where: { ...baseOrg, type: "FILE" } }),
          prisma.nBoxItem.count({ where: { ...baseOrg, type: "IMAGE" } }),
          prisma.nBoxItem.count({ where: { ...baseOrg, type: "LINK" } }),
          prisma.nBoxItem.count({ where: { ...baseOrg, type: "CONTRACT" } }),
          prisma.nBoxItem.count({ where: { ...baseOrg, type: "PROPOSAL" } }),
          prisma.nBoxItem.count({ where: { ...baseOrg, isPublic: true } }),
          prisma.nBoxItem.aggregate({
            where: baseOrg,
            _sum: { size: true },
          }),
        ]);

        const totalSizeBytes = sizeAgg._sum.size ?? 0;
        const totalSizeMB = Math.round((totalSizeBytes / (1024 * 1024)) * 10) /
          10;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          folders,
          items: {
            total: totalItems,
            inPeriod: itemsInPeriod,
            byType: {
              file: fileItems,
              image: imageItems,
              link: linkItems,
              contract: contractItems,
              proposal: proposalItems,
            },
            public: publicItems,
          },
          storage: {
            totalBytes: totalSizeBytes,
            totalMB: totalSizeMB,
          },
        };
      },
    }),

    // ── PLATFORM STATUS (Financeiro + Integrações + Space Help) ──────────
    // Combinado em uma tool — três áreas leves que costumam ser perguntadas
    // em conjunto ("como tá o financeiro?", "minhas integrações tão ok?",
    // "qual meu progresso em space help?"). Retorna 3 seções tipadas.
    get_platform_status_metrics: tool({
      description:
        "Resume status de FINANCEIRO (contas a pagar/receber/vencidas/pagas, valores em centavos), INTEGRAÇÕES (plataformas conectadas, ativas, com erro) e SPACE HELP (trilhas iniciadas/concluídas pelo user, badges conquistados). Use quando o user perguntar sobre financeiro, contas, integrações conectadas, trilhas de educação, progresso no space help.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
      }),
      execute: async ({ fromIso, toIso, orgIds }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true, role: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const baseOrg = { organizationId: { in: targetOrgs } };

        const [
          // Finance
          receivablePending,
          receivablePaid,
          receivableOverdue,
          payablePending,
          payablePaid,
          payableOverdue,
          totalReceivablePending,
          totalPayablePending,
          totalReceivedInPeriod,
          totalPaidInPeriod,
          // Integrations
          integrations,
          // Space Help (do user logado)
          spaceHelpTracksTotal,
          spaceHelpProgressList,
          spaceHelpBadges,
        ] = await Promise.all([
          prisma.paymentEntry.count({
            where: { ...baseOrg, type: "RECEIVABLE", status: "PENDING" },
          }),
          prisma.paymentEntry.count({
            where: { ...baseOrg, type: "RECEIVABLE", status: "PAID" },
          }),
          prisma.paymentEntry.count({
            where: { ...baseOrg, type: "RECEIVABLE", status: "OVERDUE" },
          }),
          prisma.paymentEntry.count({
            where: { ...baseOrg, type: "PAYABLE", status: "PENDING" },
          }),
          prisma.paymentEntry.count({
            where: { ...baseOrg, type: "PAYABLE", status: "PAID" },
          }),
          prisma.paymentEntry.count({
            where: { ...baseOrg, type: "PAYABLE", status: "OVERDUE" },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseOrg,
              type: "RECEIVABLE",
              status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
            },
            _sum: { amount: true },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseOrg,
              type: "PAYABLE",
              status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
            },
            _sum: { amount: true },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseOrg,
              type: "RECEIVABLE",
              status: "PAID",
              paidAt: { gte: from, lte: to },
            },
            _sum: { paidAmount: true },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseOrg,
              type: "PAYABLE",
              status: "PAID",
              paidAt: { gte: from, lte: to },
            },
            _sum: { paidAmount: true },
          }),
          prisma.platformIntegration.findMany({
            where: baseOrg,
            select: {
              platform: true,
              isActive: true,
              lastSyncAt: true,
              lastErrorAt: true,
              lastErrorMessage: true,
            },
          }),
          prisma.spaceHelpTrack.count({ where: { isPublished: true } }),
          prisma.spaceHelpProgress.findMany({
            where: { userId: ctx.userId },
            select: { trackId: true, completedAt: true },
          }),
          prisma.userSpaceHelpBadge.count({
            where: { userId: ctx.userId },
          }),
        ]);

        const tracksStarted = spaceHelpProgressList.length;
        const tracksCompleted = spaceHelpProgressList.filter(
          (p) => p.completedAt !== null,
        ).length;
        const tracksInProgress = tracksStarted - tracksCompleted;

        const integrationsActive = integrations.filter((i) => i.isActive).length;
        const integrationsWithError = integrations.filter(
          (i) => i.lastErrorAt !== null,
        ).length;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          finance: {
            receivable: {
              pending: receivablePending,
              paid: receivablePaid,
              overdue: receivableOverdue,
              totalPendingCents: totalReceivablePending._sum.amount ?? 0,
              receivedInPeriodCents:
                totalReceivedInPeriod._sum.paidAmount ?? 0,
            },
            payable: {
              pending: payablePending,
              paid: payablePaid,
              overdue: payableOverdue,
              totalPendingCents: totalPayablePending._sum.amount ?? 0,
              paidInPeriodCents: totalPaidInPeriod._sum.paidAmount ?? 0,
            },
          },
          integrations: {
            total: integrations.length,
            active: integrationsActive,
            inactive: integrations.length - integrationsActive,
            withError: integrationsWithError,
            list: integrations.map((i) => ({
              platform: i.platform,
              active: i.isActive,
              lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
              hasError: i.lastErrorAt !== null,
              errorMessage: i.lastErrorMessage,
            })),
          },
          spaceHelp: {
            totalTracksAvailable: spaceHelpTracksTotal,
            tracksStarted,
            tracksInProgress,
            tracksCompleted,
            badgesEarned: spaceHelpBadges,
          },
        };
      },
    }),
  };
}
