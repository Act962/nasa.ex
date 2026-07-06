import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { resolveTargetOrgs } from "@/features/astro/server/tools/shared/resolve-target-orgs";

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
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        // Todos os membros da org veem os dados da org — só usa `userIds`
        // se o caller filtrou explicitamente.
        const userFilter = userIds;

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
        "Resume métricas de TRACKING (CRM): quantidade de trackings, leads totais/no período, ativos/ganhos/perdidos, taxa de conversão, valor em pipeline, breakdown por etapa do funil (statusBreakdown — novo lead/em atendimento/aguardando/finalizado conforme configuração da org), crescimento mensal (últimos 6 meses), automações cadastradas (total/ativas), top tags. Filtros: empresa (orgIds), trackings, tags, responsáveis. Use quando perguntar 'como tá a venda', 'quantos leads em cada etapa', 'qual a conversão', 'tá crescendo?', 'quantas automações tenho'.",
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
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
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

        // ── Breakdown por STATUS (etapa do funil) ───────────────────────
        // Conta leads agrupados por statusId e enriquece com o nome do
        // status. Mostra "novo lead", "em atendimento", "aguardando",
        // "finalizado" — o que o user configurou em cada tracking.
        const statusCounts = await prisma.lead.groupBy({
          by: ["statusId"],
          where: leadWhere,
          _count: { _all: true },
        });
        const statusIds = statusCounts.map((s) => s.statusId);
        const statuses = await prisma.status.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, name: true, color: true, trackingId: true },
        });
        const statusMap = new Map(statuses.map((s) => [s.id, s]));
        const statusBreakdown = statusCounts
          .map((sc) => {
            const s = statusMap.get(sc.statusId);
            return {
              statusId: sc.statusId,
              name: s?.name ?? "(removido)",
              color: s?.color ?? null,
              trackingId: s?.trackingId ?? null,
              count: sc._count._all,
            };
          })
          .sort((a, b) => b.count - a.count);

        // ── Crescimento mensal: últimos 6 meses ─────────────────────────
        // Conta leads criados em cada mês fechado (não usa o filtro de
        // período pra mostrar tendência — sempre últimos 6 meses).
        const now = new Date();
        const monthlyGrowth: { month: string; count: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const start = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1,
            0,
            0,
            0,
            0,
          );
          const end = new Date(
            now.getFullYear(),
            now.getMonth() - i + 1,
            1,
            0,
            0,
            0,
            0,
          );
          const count = await prisma.lead.count({
            where: { ...leadWhere, createdAt: { gte: start, lt: end } },
          });
          monthlyGrowth.push({
            month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
            count,
          });
        }

        // Quantidade de automações (regras de alerta) ativas/total na org
        const [automationsTotal, automationsActive] = await Promise.all([
          prisma.alertRule.count({
            where: { organizationId: { in: targetOrgs } },
          }),
          prisma.alertRule.count({
            where: { organizationId: { in: targetOrgs }, isActive: true },
          }),
        ]);

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
          statusBreakdown,
          monthlyGrowth,
          automations: {
            total: automationsTotal,
            active: automationsActive,
          },
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
        "Resume métricas de CHAT: conversas (total/ativas/novas), mensagens enviadas vs recebidas, tempo médio de primeira resposta (TTFR), lembretes enviados, breakdown de leads por etapa do funil (novo lead/em atendimento/aguardando/finalizado). Filtros: empresa, tag, período, atendente (responsibleIds), tracking. Use quando o usuário perguntar 'quantas conversas', 'quantas mensagens', 'tempo de resposta', 'quantos leads em cada etapa pelo chat'.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
        responsibleIds: z.array(z.string()).optional(),
        tagIds: z
          .array(z.string())
          .optional()
          .describe("Filtra conversas cujo lead tem essas tags"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        trackingIds,
        responsibleIds,
        tagIds,
      }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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

        // Filtro de lead.responsibleId + leadTags opcional
        const leadSubFilter = {
          ...(responsibleIds && responsibleIds.length > 0
            ? { responsibleId: { in: responsibleIds } }
            : {}),
          ...(tagIds && tagIds.length > 0
            ? { leadTags: { some: { tagId: { in: tagIds } } } }
            : {}),
        };
        const hasLeadFilter =
          (responsibleIds && responsibleIds.length > 0) ||
          (tagIds && tagIds.length > 0);
        const convWhere = {
          trackingId: { in: tIds },
          ...(hasLeadFilter ? { lead: leadSubFilter } : {}),
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

        // ── Breakdown por STATUS dos leads que estão no chat ────────────
        // Para cada conversa existe um lead (geralmente). Agrupa os leads
        // dessas conversas por statusId pra mostrar onde estão no funil.
        const leadStatusBreakdown = await prisma.lead.groupBy({
          by: ["statusId"],
          where: {
            ...leadSubFilter,
            trackingId: { in: tIds },
            conversation: { isNot: null },
          },
          _count: { _all: true },
        });
        const statusIdsChat = leadStatusBreakdown.map((s) => s.statusId);
        const statusesChat = await prisma.status.findMany({
          where: { id: { in: statusIdsChat } },
          select: { id: true, name: true, color: true },
        });
        const statusMapChat = new Map(statusesChat.map((s) => [s.id, s]));

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
          leadStatusBreakdown: leadStatusBreakdown
            .map((g) => ({
              statusId: g.statusId,
              name: statusMapChat.get(g.statusId)?.name ?? "(removido)",
              color: statusMapChat.get(g.statusId)?.color ?? null,
              count: g._count._all,
            }))
            .sort((a, b) => b.count - a.count),
        };
      },
    }),

    // ── FORGE (propostas, receita, ticket médio) ─────────────────────────
    get_forge_metrics: tool({
      description:
        "Resume métricas de FORGE: PROPOSTAS (total/rascunho/enviadas/visualizadas/pagas/expiradas/canceladas, receita fechada/pipeline/perdida, ticket médio, desconto médio, tempo até pagamento) E CONTRATOS (total fechados/ativos/encerrados/cancelados/pendentes de assinatura, valor total). Filtros: empresa, período, criadores, leads. Use pra 'quantos contratos fechei', 'quantas propostas pagas', 'receita do mês'.",
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
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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
          // Pra calcular receita (fechada / pipeline / perdida) + ticket
          prisma.forgeProposal.findMany({
            where: {
              ...baseWhere,
              status: {
                in: [
                  "PAGA",
                  "ENVIADA",
                  "VISUALIZADA",
                  "EXPIRADA",
                  "CANCELADA",
                ],
              },
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
        const lostValues = proposalsForRevenue
          .filter((p) => p.status === "EXPIRADA" || p.status === "CANCELADA")
          .map(calcValue);

        const revenueClosed = pagasValues.reduce((a, b) => a + b, 0);
        const revenuePipeline = pipelineValues.reduce((a, b) => a + b, 0);
        const revenueLost = lostValues.reduce((a, b) => a + b, 0);
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

        // ── CONTRATOS (ForgeContract — gerados a partir de propostas pagas) ──
        // Filtra por criador se vier; usa mesma janela de período (createdAt).
        const contractWhere = {
          organizationId: { in: targetOrgs },
          ...(responsibleIds && responsibleIds.length > 0
            ? { createdById: { in: responsibleIds } }
            : {}),
        };
        const [
          totalContracts,
          contractsInPeriod,
          contractsAtivos,
          contractsEncerrados,
          contractsCancelados,
          contractsPendentesAssinatura,
          contractsValueAgg,
        ] = await Promise.all([
          prisma.forgeContract.count({ where: contractWhere }),
          prisma.forgeContract.count({
            where: {
              ...contractWhere,
              createdAt: { gte: from, lte: to },
            },
          }),
          prisma.forgeContract.count({
            where: { ...contractWhere, status: "ATIVO" },
          }),
          prisma.forgeContract.count({
            where: { ...contractWhere, status: "ENCERRADO" },
          }),
          prisma.forgeContract.count({
            where: { ...contractWhere, status: "CANCELADO" },
          }),
          prisma.forgeContract.count({
            where: { ...contractWhere, status: "PENDENTE_ASSINATURA" },
          }),
          prisma.forgeContract.aggregate({
            where: {
              ...contractWhere,
              createdAt: { gte: from, lte: to },
              status: { in: ["ATIVO", "ENCERRADO"] },
            },
            _sum: { value: true },
          }),
        ]);
        const contractsValueClosedBRL =
          Math.round(Number(contractsValueAgg._sum.value ?? 0) * 100) / 100;

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
          contracts: {
            total: totalContracts,
            inPeriod: contractsInPeriod,
            byStatus: {
              ativo: contractsAtivos,
              encerrado: contractsEncerrados,
              cancelado: contractsCancelados,
              pendenteAssinatura: contractsPendentesAssinatura,
            },
            // Valor somado dos contratos fechados (ativos + encerrados)
            // criados no período.
            closedValueBRL: contractsValueClosedBRL,
          },
          revenue: {
            closedBRL: Math.round(revenueClosed * 100) / 100,
            // "pipeline" = enviadas + visualizadas (esperando decisão do cliente)
            pipelineBRL: Math.round(revenuePipeline * 100) / 100,
            // Alias mais claro pro usuário
            openBRL: Math.round(revenuePipeline * 100) / 100,
            // "perdida" = expiradas + canceladas (vendas que não fecharam)
            lostBRL: Math.round(revenueLost * 100) / 100,
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
        "Resume métricas de WORKSPACE: quantidade de workspaces, total de actions (concluídas/abertas/atrasadas), por prioridade. Filtros: empresa, período, participante (responsável ou criador), workspace, tag, prioridade, projeto/cliente. Use quando perguntar sobre tarefas, atrasadas, workspaces.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        workspaceIds: z.array(z.string()).optional(),
        participantIds: z
          .array(z.string())
          .optional()
          .describe("Users que são responsáveis ou participantes da action"),
        tagIds: z
          .array(z.string())
          .optional()
          .describe("Filtra actions com essas tags"),
        priorities: z
          .array(z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]))
          .optional()
          .describe("Filtra por prioridades específicas"),
        orgProjectIds: z
          .array(z.string())
          .optional()
          .describe("Filtra por projetos/clientes específicos"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        workspaceIds,
        participantIds,
        tagIds,
        priorities,
        orgProjectIds,
      }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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
          ...(tagIds && tagIds.length > 0
            ? { tags: { some: { tagId: { in: tagIds } } } }
            : {}),
          ...(priorities && priorities.length > 0
            ? { priority: { in: priorities } }
            : {}),
          ...(orgProjectIds && orgProjectIds.length > 0
            ? { orgProjectId: { in: orgProjectIds } }
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
        "Resume métricas de AGENDA (spacetime/agendamentos): total/no período, por status (pendente/confirmado/realizado/cancelado/no-show), taxa de no-show, taxa de comparecimento, e breakdown POR CRIADOR (lista dos colaboradores que mais criaram appointments com count). Filtros: empresa, período, agenda, participante, tracking, projeto/cliente. Use quando perguntar sobre agenda, reuniões, agendamentos, faltas, ou 'lista dos colaboradores que criaram'.",
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
        trackingIds: z
          .array(z.string())
          .optional()
          .describe("Filtra appointments por tracking de origem"),
        orgProjectIds: z
          .array(z.string())
          .optional()
          .describe("Filtra appointments por projeto/cliente"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        agendaIds,
        participantIds,
        trackingIds,
        orgProjectIds,
      }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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
          ...(trackingIds && trackingIds.length > 0
            ? { trackingId: { in: trackingIds } }
            : {}),
          ...(orgProjectIds && orgProjectIds.length > 0
            ? { orgProjectId: { in: orgProjectIds } }
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

        // ── Breakdown por CRIADOR (Appointment.userId) ──
        // groupBy userId pra ranking de colaboradores que mais marcam
        // — útil pra perguntas tipo "lista os colaboradores que criaram".
        const byCreatorRaw = await prisma.appointment.groupBy({
          by: ["userId"],
          where: { ...apptWhere, startsAt: { gte: from, lte: to } },
          _count: { _all: true },
        });
        const creatorIds = byCreatorRaw
          .map((g) => g.userId)
          .filter((id): id is string => id !== null);
        const creators =
          creatorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: creatorIds } },
                select: { id: true, name: true, email: true },
              })
            : [];
        const creatorMap = new Map(creators.map((c) => [c.id, c]));
        const byCreator = byCreatorRaw
          .map((g) => ({
            userId: g.userId,
            name: g.userId
              ? creatorMap.get(g.userId)?.name ?? "(usuário removido)"
              : "(sem criador)",
            email: g.userId ? creatorMap.get(g.userId)?.email ?? null : null,
            count: g._count._all,
          }))
          .sort((a, b) => b.count - a.count);

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
          byCreator,
        };
      },
    }),

    // ── FORMS (formulários: submissões, conversão, abandono) ─────────────
    get_forms_metrics: tool({
      description:
        "Resume métricas de FORMS (formulários): total de formulários publicados/rascunho, total visualizados (views), submissões completas vs abandonadas, total que geraram leads, taxa de conversão pra lead, top forms por volume. Filtros: empresa, período, forms específicos, trackings (forms cujo settings aponta pra esses trackings). Use quando o user perguntar sobre formulários, submissões, leads via form, taxa de abandono.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        formIds: z
          .array(z.string())
          .optional()
          .describe("Filtra forms específicos"),
        trackingIds: z
          .array(z.string())
          .optional()
          .describe(
            "Filtra forms cujas configurações apontam pra esses trackings",
          ),
      }),
      execute: async ({ fromIso, toIso, orgIds, formIds, trackingIds }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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
          ...(trackingIds && trackingIds.length > 0
            ? { settings: { trackingId: { in: trackingIds } } }
            : {}),
        };

        const responseWhere = {
          form: formWhere,
        };

        const [
          totalForms,
          publishedForms,
          totalResponses,
          completedInPeriod,
          abandonedInPeriod,
          responsesWithLead,
          topForms,
          totalViewsAgg,
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
          prisma.form.aggregate({
            where: formWhere,
            _sum: { views: true },
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
            totalViews: totalViewsAgg._sum.views ?? 0,
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
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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
        "Resume métricas de LINNKER (bio-link pages): total de páginas publicadas/rascunho, total de acessos/scans (LinnkerScan), scans que capturaram lead, cliques em links (LinnkerLink.clicks somados), top páginas por acessos. Filtros: empresa, período. Use quando o user perguntar sobre Linnker, bio link, página de links, quantos acessos, captura de lead, cliques nos botões.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
      }),
      execute: async ({ fromIso, toIso, orgIds }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const pageWhere = { organizationId: { in: targetOrgs } };

        const [
          totalPages,
          publishedPages,
          totalScans,
          scansInPeriod,
          scansWithLead,
          clicksAgg,
          topPages,
        ] = await Promise.all([
          prisma.linnkerPage.count({ where: pageWhere }),
          prisma.linnkerPage.count({
            where: { ...pageWhere, isPublished: true },
          }),
          prisma.linnkerScan.count({ where: { page: pageWhere } }),
          prisma.linnkerScan.count({
            where: {
              page: pageWhere,
              createdAt: { gte: from, lte: to },
            },
          }),
          prisma.linnkerScan.count({
            where: {
              page: pageWhere,
              leadId: { not: null },
              createdAt: { gte: from, lte: to },
            },
          }),
          prisma.linnkerLink.aggregate({
            where: { page: pageWhere },
            _sum: { clicks: true },
          }),
          prisma.linnkerPage.findMany({
            where: pageWhere,
            select: {
              id: true,
              title: true,
              slug: true,
              isPublished: true,
              _count: { select: { scans: true } },
            },
            orderBy: { scans: { _count: "desc" } },
            take: 5,
          }),
        ]);

        const leadCaptureRate =
          scansInPeriod > 0
            ? Math.round((scansWithLead / scansInPeriod) * 100 * 10) / 10
            : 0;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          pages: {
            total: totalPages,
            published: publishedPages,
            draft: totalPages - publishedPages,
          },
          access: {
            totalScans,
            scansInPeriod,
            scansWithLead,
            leadCaptureRate,
          },
          clicks: clicksAgg._sum.clicks ?? 0,
          topPages: topPages.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            published: p.isPublished,
            scans: p._count.scans,
          })),
        };
      },
    }),

    // ── NBOX (storage: folders, items, size, tipos) ──────────────────────
    get_nbox_metrics: tool({
      description:
        "Resume métricas de NBOX (storage): total de pastas, total de itens, itens por tipo (arquivo/imagem/link/contrato/proposta), tamanho total armazenado, itens públicos compartilháveis. Filtros: empresa, período, criadores (createdByIds). Use quando o user perguntar sobre storage, arquivos, itens compartilhados, NBox.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        createdByIds: z
          .array(z.string())
          .optional()
          .describe("Filtra itens/pastas criados por users específicos"),
      }),
      execute: async ({ fromIso, toIso, orgIds, createdByIds }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const baseOrg = {
          organizationId: { in: targetOrgs },
          ...(createdByIds && createdByIds.length > 0
            ? { createdById: { in: createdByIds } }
            : {}),
        };
        const folderBase = {
          organizationId: { in: targetOrgs },
          ...(createdByIds && createdByIds.length > 0
            ? { createdById: { in: createdByIds } }
            : {}),
        };

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
          prisma.nBoxFolder.count({ where: folderBase }),
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
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
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

    // ── INSIGHTS (relatórios salvos pela org) ─────────────────────────────
    // SavedInsightReport contém snapshots de dashboards/comparativos que
    // os usuários montam no app Insights. Aqui só listamos quantos e
    // quem criou — pra detalhes/abrir, user vai no app.
    get_insights_reports: tool({
      description:
        "Lista relatórios de INSIGHTS salvos pela empresa: nome, autor, data, descrição. Mostra contagem total e os mais recentes. Filtros: empresa, período. Use quando o user perguntar 'quantos relatórios temos', 'quais relatórios foram criados', 'meus insights'.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
      }),
      execute: async ({ fromIso, toIso, orgIds }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const reportWhere = {
          organizationId: { in: targetOrgs },
        };

        const [total, inPeriod, recent] = await Promise.all([
          prisma.savedInsightReport.count({ where: reportWhere }),
          prisma.savedInsightReport.count({
            where: { ...reportWhere, createdAt: { gte: from, lte: to } },
          }),
          prisma.savedInsightReport.findMany({
            where: reportWhere,
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
        ]);

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          reports: {
            total,
            createdInPeriod: inPeriod,
          },
          recent: recent.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            createdAt: r.createdAt.toISOString(),
            author: r.createdBy.name,
          })),
        };
      },
    }),

    // ── FINANCEIRO dedicado (receita/despesa/ticket/saldo/inadimplência) ──
    // get_platform_status_metrics já tem um resumo de finance, mas aqui
    // dá pra ir fundo: ticket médio, saldo (receita - despesa pagas),
    // inadimplência (vencidos / total a receber), por categoria + conta.
    get_finance_metrics: tool({
      description:
        "Resume métricas detalhadas de FINANCEIRO: receita (a receber pendente + recebida no período), despesa (a pagar pendente + paga no período), resultado (receita - despesa) no período, ticket médio das contas pagas, saldo, taxa de inadimplência (vencidos a receber / total a receber), distribuição por categoria e por conta bancária. Filtros: empresa, período, categorias, contas bancárias. Use quando o user perguntar 'qual minha receita', 'quanto recebi', 'quanto paguei', 'qual o saldo', 'estou em inadimplência', 'ticket médio'.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        orgIds: z.array(z.string()).optional(),
        categoryIds: z
          .array(z.string())
          .optional()
          .describe("Filtra por categorias de receita/despesa"),
        accountIds: z
          .array(z.string())
          .optional()
          .describe("Filtra por contas bancárias específicas"),
      }),
      execute: async ({
        fromIso,
        toIso,
        orgIds,
        categoryIds,
        accountIds,
      }) => {
        const targetOrgs = await resolveTargetOrgs(ctx, orgIds);
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const baseWhere = {
          organizationId: { in: targetOrgs },
          ...(categoryIds && categoryIds.length > 0
            ? { categoryId: { in: categoryIds } }
            : {}),
          ...(accountIds && accountIds.length > 0
            ? { accountId: { in: accountIds } }
            : {}),
        };

        const [
          // Recebível
          receivablePendingAgg,
          receivableOverdueAgg,
          receivablePaidAgg,
          receivablePaidCount,
          // Pagável
          payablePendingAgg,
          payableOverdueAgg,
          payablePaidAgg,
          payablePaidCount,
          // Distribuição por categoria
          byCategoryReceivable,
          byCategoryPayable,
        ] = await Promise.all([
          prisma.paymentEntry.aggregate({
            where: {
              ...baseWhere,
              type: "RECEIVABLE",
              status: { in: ["PENDING", "PARTIAL"] },
            },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.aggregate({
            where: { ...baseWhere, type: "RECEIVABLE", status: "OVERDUE" },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseWhere,
              type: "RECEIVABLE",
              status: "PAID",
              paidAt: { gte: from, lte: to },
            },
            _sum: { paidAmount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.count({
            where: {
              ...baseWhere,
              type: "RECEIVABLE",
              status: "PAID",
              paidAt: { gte: from, lte: to },
            },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseWhere,
              type: "PAYABLE",
              status: { in: ["PENDING", "PARTIAL"] },
            },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.aggregate({
            where: { ...baseWhere, type: "PAYABLE", status: "OVERDUE" },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.aggregate({
            where: {
              ...baseWhere,
              type: "PAYABLE",
              status: "PAID",
              paidAt: { gte: from, lte: to },
            },
            _sum: { paidAmount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.count({
            where: {
              ...baseWhere,
              type: "PAYABLE",
              status: "PAID",
              paidAt: { gte: from, lte: to },
            },
          }),
          prisma.paymentEntry.groupBy({
            by: ["categoryId"],
            where: {
              ...baseWhere,
              type: "RECEIVABLE",
              paidAt: { gte: from, lte: to },
              status: "PAID",
            },
            _sum: { paidAmount: true },
            _count: { _all: true },
          }),
          prisma.paymentEntry.groupBy({
            by: ["categoryId"],
            where: {
              ...baseWhere,
              type: "PAYABLE",
              paidAt: { gte: from, lte: to },
              status: "PAID",
            },
            _sum: { paidAmount: true },
            _count: { _all: true },
          }),
        ]);

        // Enriquece categorias com nome
        const allCategoryIds = [
          ...byCategoryReceivable.map((c) => c.categoryId),
          ...byCategoryPayable.map((c) => c.categoryId),
        ].filter((id): id is string => id !== null);
        const categories =
          allCategoryIds.length > 0
            ? await prisma.paymentCategory.findMany({
                where: { id: { in: allCategoryIds } },
                select: { id: true, name: true, type: true },
              })
            : [];
        const categoryMap = new Map(categories.map((c) => [c.id, c]));

        const receivedCents = receivablePaidAgg._sum.paidAmount ?? 0;
        const paidCents = payablePaidAgg._sum.paidAmount ?? 0;
        const resultCents = receivedCents - paidCents;
        const pendingReceivableCents = receivablePendingAgg._sum.amount ?? 0;
        const overdueReceivableCents = receivableOverdueAgg._sum.amount ?? 0;
        const totalReceivableCents =
          pendingReceivableCents + overdueReceivableCents + receivedCents;
        const overdueRate =
          totalReceivableCents > 0
            ? Math.round(
                (overdueReceivableCents / totalReceivableCents) * 100 * 10,
              ) / 10
            : 0;
        const avgTicketCents =
          receivablePaidCount > 0
            ? Math.round(receivedCents / receivablePaidCount)
            : 0;

        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          receivable: {
            pendingCents: pendingReceivableCents,
            pendingCount: receivablePendingAgg._count._all,
            overdueCents: overdueReceivableCents,
            overdueCount: receivableOverdueAgg._count._all,
            receivedInPeriodCents: receivedCents,
            receivedCount: receivablePaidCount,
          },
          payable: {
            pendingCents: payablePendingAgg._sum.amount ?? 0,
            pendingCount: payablePendingAgg._count._all,
            overdueCents: payableOverdueAgg._sum.amount ?? 0,
            overdueCount: payableOverdueAgg._count._all,
            paidInPeriodCents: paidCents,
            paidCount: payablePaidCount,
          },
          result: {
            // Resultado = recebido - pago (caixa real, não competência)
            netCents: resultCents,
          },
          avgTicketReceivedCents: avgTicketCents,
          overdueRatePercent: overdueRate,
          byCategory: {
            receivable: byCategoryReceivable.map((c) => ({
              categoryId: c.categoryId,
              name: c.categoryId
                ? categoryMap.get(c.categoryId)?.name ?? "(sem categoria)"
                : "(sem categoria)",
              totalCents: c._sum.paidAmount ?? 0,
              count: c._count._all,
            })),
            payable: byCategoryPayable.map((c) => ({
              categoryId: c.categoryId,
              name: c.categoryId
                ? categoryMap.get(c.categoryId)?.name ?? "(sem categoria)"
                : "(sem categoria)",
              totalCents: c._sum.paidAmount ?? 0,
              count: c._count._all,
            })),
          },
        };
      },
    }),

    // ── SPACE HELP catalog (trilhas + lições + links pra navegação) ──────
    // get_platform_status_metrics já tem o progresso do user. Aqui o Astro
    // consegue LISTAR as trilhas disponíveis (título, descrição, slug) pra
    // recomendar pro user — ex: "qual trilha aprendo sobre Tracking?".
    get_space_help_catalog: tool({
      description:
        "Lista trilhas do SPACE HELP (educação). Cada trilha tem título, descrição, link `/space-help/trilhas/{slug}`, nível, duração, recompensas (Stars/SP/badge), progresso do user. Quando `includeLessons=true`, retorna também TODAS as lições da trilha com `youtubeUrl` (link do vídeo no YouTube), `contentMd` resumido, `durationMin` e flag `completedByUser`. Use quando user perguntar 'qual trilha sobre X', 'como aprendo Y', 'me passe os vídeos da trilha Z'.",
      inputSchema: z.object({
        search: z
          .string()
          .optional()
          .describe("Palavra-chave pra filtrar trilhas por título/subtítulo"),
        level: z
          .enum(["beginner", "intermediate", "advanced"])
          .optional()
          .describe("Filtra por nível"),
        categoryIds: z.array(z.string()).optional(),
        includeLessons: z
          .boolean()
          .optional()
          .describe(
            "Se true, traz as lições de cada trilha com youtubeUrl. Use quando o user pedir 'vídeos da trilha', 'lições', 'aulas', 'me passa o link do vídeo'.",
          ),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        search,
        level,
        categoryIds,
        includeLessons,
        limit,
      }) => {
        const tracks = await prisma.spaceHelpTrack.findMany({
          where: {
            isPublished: true,
            ...(level ? { level } : {}),
            ...(categoryIds && categoryIds.length > 0
              ? { categoryId: { in: categoryIds } }
              : {}),
            ...(search
              ? {
                  OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { subtitle: { contains: search, mode: "insensitive" } },
                    {
                      description: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            description: true,
            level: true,
            durationMin: true,
            rewardStars: true,
            rewardSpacePoints: true,
            category: { select: { id: true, name: true } },
            rewardBadge: { select: { id: true, name: true } },
            _count: { select: { lessons: true } },
            // Lições inline só quando o caller pediu — evita payload
            // gigante quando user só quer listar trilhas.
            ...(includeLessons
              ? {
                  lessons: {
                    select: {
                      id: true,
                      title: true,
                      summary: true,
                      youtubeUrl: true,
                      durationMin: true,
                      order: true,
                    },
                    orderBy: { order: "asc" as const },
                  },
                }
              : {}),
          },
          orderBy: { order: "asc" },
          take: limit ?? 20,
        });

        // Progresso do user logado por trilha
        const progress = await prisma.spaceHelpProgress.findMany({
          where: {
            userId: ctx.userId,
            trackId: { in: tracks.map((t) => t.id) },
          },
          select: { trackId: true, completedAt: true, completedLessonIds: true },
        });
        const progressMap = new Map(progress.map((p) => [p.trackId, p]));

        return {
          totalAvailable: tracks.length,
          tracks: tracks.map((t) => {
            const p = progressMap.get(t.id);
            const completedIds = new Set(p?.completedLessonIds ?? []);
            const completedLessons = completedIds.size;
            const status: "not-started" | "in-progress" | "completed" =
              p?.completedAt
                ? "completed"
                : p
                  ? "in-progress"
                  : "not-started";
            return {
              id: t.id,
              slug: t.slug,
              title: t.title,
              subtitle: t.subtitle,
              description: t.description,
              level: t.level,
              durationMin: t.durationMin,
              category: t.category?.name ?? null,
              rewards: {
                stars: t.rewardStars,
                spacePoints: t.rewardSpacePoints,
                badge: t.rewardBadge?.name ?? null,
              },
              lessonsTotal: t._count.lessons,
              lessonsCompletedByUser: completedLessons,
              status,
              // Link interno pra abrir a trilha no app.
              link: `/space-help/trilhas/${t.slug}`,
              // Lições com link do YouTube — Astro deve citar/enviar
              // direto esses URLs quando o user pedir vídeos.
              ...(includeLessons && "lessons" in t
                ? {
                    lessons: (
                      t as typeof t & {
                        lessons: {
                          id: string;
                          title: string;
                          summary: string | null;
                          youtubeUrl: string | null;
                          durationMin: number | null;
                          order: number;
                        }[];
                      }
                    ).lessons.map((l) => ({
                      id: l.id,
                      order: l.order,
                      title: l.title,
                      summary: l.summary,
                      youtubeUrl: l.youtubeUrl,
                      durationMin: l.durationMin,
                      completedByUser: completedIds.has(l.id),
                    })),
                  }
                : {}),
            };
          }),
        };
      },
    }),

    // ── SPACE HELP — FEATURES (tutoriais por funcionalidade) ──────────────
    // Cada feature = tutorial dum recurso/funcionalidade (ex: "Como criar
    // um lead", "Criar proposta", "Configurar agenda"). Tem vídeo do
    // YouTube + steps passo-a-passo com screenshots.
    //
    // Retorna `{ kind: "astro_videos", videos: [...] }` quando há features
    // — o cliente renderiza grid de cards com thumbnail. Senão retorna
    // `{ kind: "astro_videos", videos: [] }` com caption explicando.
    //
    // Busca FUZZY: tokeniza a query em palavras, OR'eia cada token contra
    // title/summary/categoria. Match parcial — "criar produto" pega
    // features tipo "criar proposta" (token "criar" match), e o LLM
    // decide se é útil. Aumenta recall em troca de precision (que o
    // próprio LLM filtra na resposta).
    get_space_help_features: tool({
      description:
        "Busca tutoriais por funcionalidade no SPACE HELP. Cada feature tem vídeo do YouTube (`youtubeUrl`), steps com screenshots, e link interno `/space-help/{categorySlug}/{featureSlug}`. RETORNA payload `astro_videos` — o cliente renderiza cards com thumbnail automaticamente, NÃO precisa repetir a lista em texto. Use SEMPRE quando user pedir 'como faço X', 'como uso Y', 'me ensina a Z', 'video de W', 'tutorial de K'. Busca FUZZY — tenta com a query do user direto, palavras parciais funcionam.",
      inputSchema: z.object({
        search: z
          .string()
          .optional()
          .describe(
            "Palavra-chave (ex: 'criar lead', 'proposta', 'agenda', 'automação'). Multi-palavra é OK — tokeniza e busca cada termo.",
          ),
        categorySlugs: z
          .array(z.string())
          .optional()
          .describe(
            "Filtra por categorias (slug: 'tracking', 'chat', 'forge', 'workspace', etc).",
          ),
        includeSteps: z
          .boolean()
          .optional()
          .describe(
            "Se true, retorna os steps detalhados no payload em campo separado pro LLM ler (não afeta o card). Default false.",
          ),
        limit: z.number().int().min(1).max(30).optional(),
      }),
      execute: async ({ search, categorySlugs, includeSteps, limit }) => {
        // Tokeniza search em palavras (≥3 chars), normaliza acentos.
        // OR de cada token contra title/summary/category.name pra
        // recall amplo. "criar produto" vira ["criar","produto"] e
        // pega "Criar Proposta" (via token "criar").
        const tokens = (search ?? "")
          .toLowerCase()
          .normalize("NFD")
          // Remove diacríticos: U+0300–U+036F (Combining Diacritical Marks).
          .replace(/[̀-ͯ]/g, "")
          .split(/\s+/)
          .filter((t) => t.length >= 3);

        const selectShape = {
          id: true,
          slug: true,
          title: true,
          summary: true,
          youtubeUrl: true,
          order: true,
          category: { select: { slug: true, name: true } },
          _count: { select: { steps: true } },
          ...(includeSteps
            ? {
                steps: {
                  select: {
                    id: true,
                    order: true,
                    title: true,
                    description: true,
                    screenshotUrl: true,
                  },
                  orderBy: { order: "asc" as const },
                },
              }
            : {}),
        } as const;

        const baseOrderBy = [
          { category: { order: "asc" as const } },
          { order: "asc" as const },
        ];

        // 1ª tentativa: com filtros do user (categoria + tokens de search).
        // NÃO filtra por category.isPublished — algumas bases têm features
        // legítimas em categorias com isPublished=false e o user só não
        // tem como ver pela UI, mas via Astro faz sentido sempre achar.
        const baseWhere = {
          ...(categorySlugs && categorySlugs.length > 0
            ? { category: { slug: { in: categorySlugs } } }
            : {}),
        };
        const searchWhere =
          tokens.length > 0
            ? {
                OR: tokens.flatMap((t) => [
                  { title: { contains: t, mode: "insensitive" as const } },
                  { summary: { contains: t, mode: "insensitive" as const } },
                  {
                    category: {
                      name: { contains: t, mode: "insensitive" as const },
                    },
                  },
                ]),
              }
            : {};

        let features = await prisma.spaceHelpFeature.findMany({
          where: { ...baseWhere, ...searchWhere },
          select: selectShape,
          orderBy: baseOrderBy,
          take: limit ?? 10,
        });

        // FALLBACK 1: 0 hits + havia search → refaz só por categoria (ou
        // pega tudo se sem categoria). Garante que o user veja ALGO em
        // vez do Astro responder "não achei".
        let fallbackUsed: "none" | "broadened" | "global" = "none";
        if (features.length === 0 && tokens.length > 0) {
          features = await prisma.spaceHelpFeature.findMany({
            where: baseWhere,
            select: selectShape,
            orderBy: baseOrderBy,
            take: limit ?? 10,
          });
          fallbackUsed = "broadened";
        }

        // FALLBACK 2: ainda 0 + havia categoria → busca global (qualquer
        // feature). Backstop final pra Astro sempre ter algo a oferecer.
        if (features.length === 0 && categorySlugs && categorySlugs.length > 0) {
          features = await prisma.spaceHelpFeature.findMany({
            select: selectShape,
            orderBy: baseOrderBy,
            take: limit ?? 10,
          });
          fallbackUsed = "global";
        }

        const withVideo = features.filter((f) => f.youtubeUrl);
        const withoutVideo = features.filter((f) => !f.youtubeUrl);

        // Caption baseada em (a) houve hit direto vs fallback, (b)
        // teve video, (c) tem tutorial só escrito. Sempre dá um
        // próximo passo — nunca beco sem saída tipo "tenta outra
        // palavra".
        const totalAny = withVideo.length + withoutVideo.length;
        let caption: string;
        if (totalAny === 0) {
          caption =
            "Não encontrei tutoriais cadastrados ainda. Veja a [biblioteca completa](/space-help) — vai ter mais novidade por lá.";
        } else if (fallbackUsed === "global") {
          caption = `Não achei tutorial específico sobre "${search ?? ""}", mas aqui tão alguns que podem ajudar. Veja todos em [Space Help](/space-help).`;
        } else if (fallbackUsed === "broadened") {
          caption = `Não achei match exato pra "${search ?? ""}", aqui tão tutoriais da mesma área. Ver todos: [Space Help](/space-help).`;
        } else if (withVideo.length === 0 && withoutVideo.length > 0) {
          caption = `Achei ${withoutVideo.length} tutorial(is) escrito(s) (passo-a-passo) — sem vídeo ainda. Clica no link de cada um pra ver o detalhe.`;
        } else if (withVideo.length === 1) {
          caption =
            "Achei 1 tutorial — clica no card pra abrir o player com passo-a-passo.";
        } else {
          caption = `Achei ${withVideo.length} tutoriais — clica em qualquer card pra abrir.`;
        }

        return {
          kind: "astro_videos" as const,
          title:
            totalAny > 0
              ? search
                ? `Tutoriais relacionados a "${search}"`
                : "Tutoriais do Space Help"
              : undefined,
          caption,
          videos: withVideo.map((f) => ({
            id: f.id,
            title: f.title,
            summary: f.summary,
            youtubeUrl: f.youtubeUrl!,
            category: f.category?.name ?? null,
            durationMin: null,
            link: `/space-help/${f.category?.slug ?? ""}/${f.slug}`,
          })),
          // Tutoriais sem vídeo (só passo-a-passo escrito) — pro LLM
          // mencionar como link interno na resposta.
          textOnlyTutorials: withoutVideo.map((f) => ({
            title: f.title,
            summary: f.summary,
            category: f.category?.name ?? null,
            link: `/space-help/${f.category?.slug ?? ""}/${f.slug}`,
            stepsCount: f._count.steps,
          })),
          totalFound: features.length,
          fallbackUsed,
          ...(includeSteps
            ? {
                stepsByFeature: features
                  .filter(
                    (
                      f,
                    ): f is typeof f & {
                      steps: {
                        id: string;
                        order: number;
                        title: string;
                        description: string;
                        screenshotUrl: string | null;
                      }[];
                    } => "steps" in f && Array.isArray((f as { steps?: unknown }).steps),
                  )
                  .map((f) => ({
                    featureId: f.id,
                    featureTitle: f.title,
                    steps: f.steps,
                  })),
              }
            : {}),
        };
      },
    }),
  };
}
