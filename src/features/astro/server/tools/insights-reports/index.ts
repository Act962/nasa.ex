import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { userBelongsToOrg } from "@/features/astro/server/tools/_shared/permissions";
import { computeFunnel } from "@/features/insights/lib/metrics/funnel";
import { computeWonLeads } from "@/features/insights/lib/metrics/won-leads";
import { computeSoldThisMonth } from "@/features/insights/lib/metrics/sold-this-month";
import { computeAcquisitionChannels } from "@/features/insights/lib/metrics/acquisition-channels";
import { computeLeadsByTags } from "@/features/insights/lib/metrics/leads-by-tags";

/**
 * Tools de RELATÓRIOS de INSIGHTS — expõem pelo Astro os mesmos números da
 * página /insights (funil, ganhos/perdidos, vendidos no mês, canais, tags).
 * Read-only e SINGLE-ORG: usam `ctx.organizationId` (a org do número da
 * tracking no WhatsApp, ou a org atual no Cmd+K), nunca agregam multi-org —
 * relatórios de insights são por empresa. Compartilham o cálculo com as
 * procedures via `src/features/insights/lib/metrics/*` (fonte de verdade única).
 */
export function buildInsightsReportTools(ctx: AgentContext) {
  const NO_ACCESS = { error: "Sem acesso a esta organização" } as const;

  return {
    get_funnel: tool({
      description:
        "Funil de conversão de UM tracking: leads ativos por etapa, tempo médio em cada etapa (horas) e queda (drop-off) entre etapas. Use quando o user perguntar 'como tá meu funil', 'onde os leads estão travando', 'quantos leads em cada etapa'. Se houver mais de um tracking e o user não disse qual, peça pra escolher.",
      inputSchema: z.object({
        trackingId: z
          .string()
          .optional()
          .describe(
            "Tracking do funil. Se omitido e a org tiver só 1 tracking, usa ela; se tiver várias, retorna a lista pra escolher.",
          ),
        fromIso: z.string().optional().describe("Início do período (ISO 8601)"),
        toIso: z.string().optional().describe("Fim do período (ISO 8601)"),
      }),
      execute: async ({ trackingId, fromIso, toIso }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return NO_ACCESS;
        }

        let targetTrackingId = trackingId;
        if (!targetTrackingId) {
          const trackings = await prisma.tracking.findMany({
            where: { organizationId: ctx.organizationId, isArchived: false },
            select: { id: true, name: true },
            orderBy: { createdAt: "desc" },
          });
          if (trackings.length === 0) {
            return { error: "Nenhuma tracking encontrada nesta empresa" };
          }
          if (trackings.length > 1) {
            return {
              needsTracking: true,
              message: "Mais de uma tracking — peça ao user qual usar.",
              trackings,
            };
          }
          targetTrackingId = trackings[0]!.id;
        }

        const result = await computeFunnel({
          organizationIds: [ctx.organizationId],
          trackingId: targetTrackingId,
          startDate: fromIso ? new Date(fromIso) : undefined,
          endDate: toIso ? new Date(toIso) : undefined,
        });
        if (!result) {
          return { error: "Tracking não encontrada nesta empresa" };
        }
        return result;
      },
    }),

    get_won_lost_leads: tool({
      description:
        "Leads ganhos x perdidos no período + taxa de conversão + principais motivos de ganho. Use quando o user perguntar 'quantos fechei', 'minha taxa de conversão', 'ganhos e perdas', 'por que ganhei'.",
      inputSchema: z.object({
        trackingId: z
          .string()
          .optional()
          .describe("Filtra um tracking. Default: toda a empresa."),
        fromIso: z.string().optional().describe("Início do período (ISO 8601)"),
        toIso: z.string().optional().describe("Fim do período (ISO 8601)"),
      }),
      execute: async ({ trackingId, fromIso, toIso }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return NO_ACCESS;
        }
        return computeWonLeads({
          organizationId: ctx.organizationId,
          trackingId,
          startDate: fromIso ? new Date(fromIso) : undefined,
          endDate: toIso ? new Date(toIso) : undefined,
        });
      },
    }),

    get_sold_this_month: tool({
      description:
        "Leads ganhos no mês atual vs mês anterior, variação percentual e breakdown diário. Use quando o user perguntar 'quanto vendi esse mês', 'fechamentos do mês', 'comparado ao mês passado'.",
      inputSchema: z.object({
        trackingId: z
          .string()
          .optional()
          .describe("Filtra um tracking. Default: toda a empresa."),
        referenceMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("Mês de referência 'YYYY-MM'. Default: mês atual."),
      }),
      execute: async ({ trackingId, referenceMonth }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return NO_ACCESS;
        }
        return computeSoldThisMonth({
          organizationId: ctx.organizationId,
          trackingId,
          referenceMonth,
        });
      },
    }),

    get_leads_by_channel: tool({
      description:
        "Distribuição de leads por canal de aquisição (WhatsApp, formulário, agenda, manual...) com % do total e conversão por canal. Use quando o user perguntar 'de onde vêm meus leads', 'qual canal converte mais', 'origem dos leads'.",
      inputSchema: z.object({
        trackingId: z
          .string()
          .optional()
          .describe("Filtra um tracking. Default: toda a empresa."),
        fromIso: z.string().optional().describe("Início do período (ISO 8601)"),
        toIso: z.string().optional().describe("Fim do período (ISO 8601)"),
      }),
      execute: async ({ trackingId, fromIso, toIso }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return NO_ACCESS;
        }
        return computeAcquisitionChannels({
          organizationId: ctx.organizationId,
          trackingId,
          startDate: fromIso ? new Date(fromIso) : undefined,
          endDate: toIso ? new Date(toIso) : undefined,
        });
      },
    }),

    get_leads_by_tags: tool({
      description:
        "Quantos leads têm cada tag (contagem por etiqueta) + total de leads etiquetados. Use quando o user perguntar 'quantos leads por tag', 'distribuição de etiquetas', 'leads marcados como X'.",
      inputSchema: z.object({
        trackingId: z
          .string()
          .optional()
          .describe("Filtra um tracking. Default: toda a empresa."),
        toIso: z
          .string()
          .optional()
          .describe(
            "Data de referência (ISO 8601) — conta quem TINHA a tag nessa data. Default: hoje.",
          ),
        includeArchived: z
          .boolean()
          .optional()
          .describe("Inclui tags arquivadas. Default: false."),
      }),
      execute: async ({ trackingId, toIso, includeArchived }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return NO_ACCESS;
        }
        return computeLeadsByTags({
          organizationId: ctx.organizationId,
          trackingId,
          endDate: toIso ? new Date(toIso) : undefined,
          includeArchived,
        });
      },
    }),
  };
}
