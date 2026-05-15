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
                organizationId: { in: targetOrgs },
                createdAt: { gte: from, lte: to },
                ...(userFilter && userFilter.length > 0
                  ? { userId: { in: userFilter } }
                  : {}),
              },
              select: { amount: true, action: true },
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
          (sum, t) => sum + (t.amount > 0 ? t.amount : 0),
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
  };
}
