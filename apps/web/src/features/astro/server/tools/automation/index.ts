import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  ALERT_CATALOG,
  AUDIENCE_KINDS,
  getAlertEvent,
} from "@/features/alerts/lib/alert-catalog";
import {
  isSeverity,
  isDisplaySurface,
  resolveDisplaySurface,
} from "@/features/alerts/lib/severity";
import { AUDIENCE_LABELS } from "@/features/alerts/lib/audience-resolver";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  userBelongsToOrg,
  userIsOrgAdmin,
} from "@/features/astro/server/tools/_shared/permissions";

/**
 * Tools de Automação/Alertas para o sub-agente automation-agent.
 *
 * Permite que o Astro descubra eventos suportados, liste regras existentes
 * e crie/edite/desligue regras a partir de instrução em linguagem natural.
 *
 * Permissão: regras `organizationId=null` (globais) só Master cria;
 * regras com `organizationId` setado só admins da própria org.
 */
export function buildAutomationTools(ctx: AgentContext) {
  return {
    list_alert_events: tool({
      description:
        "Lista os tipos de evento de alerta suportados pelo sistema (catálogo). Use SEMPRE primeiro pra saber quais eventos existem e quais parâmetros cada um aceita antes de criar regra.",
      inputSchema: z.object({
        category: z
          .enum([
            "lead",
            "form",
            "chat",
            "forge",
            "agenda",
            "integration",
            "metric",
            "broadcast",
            "action",
          ])
          .optional()
          .describe("Filtrar por categoria"),
      }),
      execute: async ({ category }) => {
        const events = ALERT_CATALOG.filter(
          (d) => !category || d.category === category,
        ).map((d) => ({
          key: d.key,
          label: d.label,
          description: d.description,
          category: d.category,
          audienceOptions: d.audienceOptions,
          supportsCooldown: d.supportsCooldown,
          // Lista os campos de params que o evento aceita (deduzido do schema).
          // O agente pode inferir o tipo de cada campo no description.
          paramsHint: describeParams(d.key),
        }));
        return { events, total: events.length };
      },
    }),

    list_alert_rules: tool({
      description:
        "Lista regras de alerta ativas (ou todas) da organização atual. Use pra evitar duplicar regras antes de criar uma nova.",
      inputSchema: z.object({
        includeInactive: z.boolean().default(false),
        eventType: z.string().optional(),
      }),
      execute: async ({ includeInactive, eventType }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const rules = await prisma.alertRule.findMany({
          where: {
            // Regras globais (Master) + da própria org
            OR: [
              { organizationId: null },
              { organizationId: ctx.organizationId },
            ],
            ...(includeInactive ? {} : { isActive: true }),
            ...(eventType ? { eventType } : {}),
          },
          select: {
            id: true,
            name: true,
            description: true,
            eventType: true,
            params: true,
            severity: true,
            audience: true,
            channels: true,
            displaySurface: true,
            isActive: true,
            cooldownMinutes: true,
            organizationId: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        return {
          rules: rules.map((r) => ({
            ...r,
            isGlobal: r.organizationId === null,
          })),
        };
      },
    }),

    create_alert_rule: tool({
      description:
        "Cria uma nova regra de alerta na organização atual. SEMPRE confirme os parâmetros com o usuário antes de chamar esta tool.",
      inputSchema: z.object({
        name: z
          .string()
          .min(3)
          .max(80)
          .describe("Nome curto e descritivo (ex: 'Lead 2 dias parado')"),
        description: z.string().optional(),
        eventType: z
          .string()
          .describe(
            "Chave do evento do catálogo (use list_alert_events pra ver opções)",
          ),
        params: z
          .record(z.string(), z.unknown())
          .default({})
          .describe(
            "Parâmetros do evento (ex: { days: 2 } pra lead.stale). Pode ser objeto vazio.",
          ),
        severity: z
          .enum(["info", "warning", "critical"])
          .describe("Nível visual: info=bell, warning=toast, critical=popup"),
        audience: z
          .object({
            kind: z.enum(AUDIENCE_KINDS),
            userIds: z.array(z.string()).optional(),
          })
          .describe("Quem recebe o alerta"),
        channels: z
          .array(z.enum(["in_app", "whatsapp"]))
          .default(["in_app"])
          .describe("Canais de entrega"),
        displaySurface: z
          .enum(["bell", "toast", "popup"])
          .optional()
          .describe("Override do default (deriva da severity)"),
        cooldownMinutes: z
          .number()
          .int()
          .min(1)
          .max(1440)
          .optional()
          .describe(
            "Anti-spam: tempo mínimo entre 2 disparos da MESMA regra (em min)",
          ),
      }),
      execute: async (input) => {
        if (!(await userIsOrgAdmin(ctx.userId, ctx.organizationId))) {
          return {
            error:
              "Você precisa ser admin ou owner da organização pra criar regras de alerta.",
          };
        }

        const def = getAlertEvent(input.eventType);
        if (!def) {
          return {
            error: `Evento "${input.eventType}" não existe no catálogo. Use list_alert_events pra ver os disponíveis.`,
          };
        }

        // Valida params da regra vs schema do evento
        const paramsParsed = def.paramsSchema.safeParse(input.params);
        if (!paramsParsed.success) {
          return {
            error: `Parâmetros inválidos pra ${input.eventType}: ${paramsParsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
          };
        }

        // Audiência deve estar dentro das audienceOptions do evento
        if (!def.audienceOptions.includes(input.audience.kind)) {
          return {
            error: `Audiência "${input.audience.kind}" não é válida pra ${input.eventType}. Opções: ${def.audienceOptions.join(", ")}.`,
          };
        }

        const severity = isSeverity(input.severity) ? input.severity : "info";
        const displaySurface =
          input.displaySurface && isDisplaySurface(input.displaySurface)
            ? input.displaySurface
            : resolveDisplaySurface(severity);

        const created = await prisma.alertRule.create({
          data: {
            organizationId: ctx.organizationId,
            name: input.name,
            description: input.description ?? null,
            eventType: input.eventType,
            params: paramsParsed.data as Prisma.InputJsonValue,
            severity,
            audience: input.audience as unknown as Prisma.InputJsonValue,
            channels: input.channels as unknown as Prisma.InputJsonValue,
            displaySurface,
            isActive: true,
            createdBy: ctx.userId,
            cooldownMinutes: input.cooldownMinutes ?? null,
          },
          select: { id: true, name: true, eventType: true, severity: true },
        });

        return {
          success: true,
          rule: created,
          summary: `Regra "${created.name}" criada — quando "${def.label}" ocorrer, dispara alerta ${severity} pra ${AUDIENCE_LABELS[input.audience.kind]}.`,
        };
      },
    }),

    toggle_alert_rule: tool({
      description:
        "Liga ou desliga uma regra existente (sem deletar). Use quando o usuário pede pra 'pausar' ou 'reativar' uma regra.",
      inputSchema: z.object({
        ruleId: z.string(),
        isActive: z.boolean(),
      }),
      execute: async ({ ruleId, isActive }) => {
        if (!(await userIsOrgAdmin(ctx.userId, ctx.organizationId))) {
          return { error: "Sem permissão (precisa ser admin/owner)" };
        }
        const rule = await prisma.alertRule.findUnique({
          where: { id: ruleId },
          select: { organizationId: true, name: true },
        });
        if (!rule) return { error: "Regra não encontrada" };
        if (rule.organizationId !== ctx.organizationId) {
          return {
            error:
              "Essa é uma regra global do sistema — só Master pode mexer. Crie uma regra própria pra sobrescrever.",
          };
        }
        await prisma.alertRule.update({
          where: { id: ruleId },
          data: { isActive },
        });
        return {
          success: true,
          summary: `Regra "${rule.name}" ${isActive ? "ativada" : "desativada"}.`,
        };
      },
    }),

    // Deleção NÃO está disponível via Astro/LLM — por política de segurança,
    // user precisa deletar regras manualmente pela UI. Use toggle_alert_rule
    // pra desativar temporariamente. Veja PERSONA_CORE pra a frase exata
    // que o agent deve usar quando user pedir pra deletar.
  };
}

/**
 * Descrição em linguagem natural dos params aceitos por cada evento.
 * Mantém o agente bem informado sem precisar parsear Zod schema interno.
 */
function describeParams(eventKey: string): string {
  switch (eventKey) {
    case "lead.status_changed":
      return "statusId (string) — id do status alvo";
    case "lead.tag_added":
      return "tagId (string) — id da tag alvo";
    case "lead.stale":
      return "days (1-60) — quantos dias sem contato pra alertar";
    case "form.submitted":
      return "formId (string, opcional) — formulário específico ou todos";
    case "form.abandoned":
      return "minutes (5-1440) — minutos sem completar";
    case "chat.message_received":
      return "workspaceId (string, opcional)";
    case "forge.proposal_status_changed":
      return "toStatus (enum opcional) — RASCUNHO|ENVIADA|VISUALIZADA|ACEITA|PAGA|EXPIRADA|CANCELADA";
    case "agenda.starting_soon":
      return "minutesBefore (1-1440) — quantos minutos antes alertar";
    case "metric.below_threshold":
      return "metric (enum) + threshold (number) + windowDays (1-90)";
    case "action.overdue":
      return "daysOverdue (1-60, opcional)";
    default:
      return "(sem params)";
  }
}
