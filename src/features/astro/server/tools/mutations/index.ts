import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { userBelongsToOrg } from "@/features/astro/server/tools/_shared/permissions";

/**
 * Tools de mutação de baixo nível — usadas pelos sub-agentes pra criar
 * entidades a partir de instrução natural. Cada tool faz UMA coisa, valida
 * permissão, retorna estado pro LLM responder em texto natural.
 *
 * Por que separado das tools "domain-specific" (actions/, leads/)? Porque
 * são primitivas — qualquer agente pode reusar (closer pra criar lead após
 * conversa, task-agent pra agendamento, automation-agent pra tag de regra).
 */

export function buildMutationTools(ctx: AgentContext) {
  return {
    create_lead: tool({
      description:
        "Cria um novo lead na organização atual. Requer trackingId — se o user não especificar, use o primeiro tracking ativo OU peça pra ele escolher antes (use search_entities('tracking', '')).",
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        phone: z
          .string()
          .optional()
          .describe("Telefone com DDD (ex: '11 99999-9999')"),
        email: z.string().email().optional(),
        document: z.string().optional().describe("CPF/CNPJ"),
        trackingId: z
          .string()
          .describe(
            "ID do tracking — obtenha via search_entities('tracking', ...) se o user falou o nome",
          ),
        description: z.string().optional(),
      }),
      execute: async ({
        name,
        phone,
        email,
        document,
        trackingId,
        description,
      }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        // Valida tracking pertence à org + pega primeiro status (entrada do funil)
        const tracking = await prisma.tracking.findFirst({
          where: { id: trackingId, organizationId: ctx.organizationId },
          select: {
            id: true,
            name: true,
            status: {
              select: { id: true, name: true },
              orderBy: { order: "asc" },
              take: 1,
            },
          },
        });
        if (!tracking) {
          return {
            error: `Tracking ${trackingId} não encontrado nessa organização.`,
          };
        }
        const firstStatus = tracking.status[0];
        if (!firstStatus) {
          return {
            error: `Tracking "${tracking.name}" não tem nenhum status configurado. Configure o funil antes.`,
          };
        }

        try {
          const lead = await prisma.lead.create({
            data: {
              name,
              phone: phone ?? null,
              email: email ?? null,
              document: document ?? null,
              description: description ?? null,
              trackingId: tracking.id,
              statusId: firstStatus.id,
              responsibleId: ctx.userId,
            },
            select: { id: true, name: true },
          });
          return {
            success: true,
            leadId: lead.id,
            summary: `Lead "${lead.name}" criado em "${tracking.name}", status inicial "${firstStatus.name}".`,
          };
        } catch (err) {
          if (
            err != null &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
          ) {
            return {
              error: `Já existe um lead com esse telefone em "${tracking.name}".`,
            };
          }
          return {
            error: err instanceof Error ? err.message : "Erro ao criar lead",
          };
        }
      },
    }),

    create_tag: tool({
      description:
        "Cria uma nova tag na organização. Slug é auto-derivado do nome (kebab-case sem acentos).",
      inputSchema: z.object({
        name: z.string().min(1).max(40),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe("Cor hex (ex: '#1447e6')"),
        description: z.string().optional(),
      }),
      execute: async ({ name, color, description }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const slug = name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        try {
          const tag = await prisma.tag.create({
            data: {
              name,
              slug: slug || `tag-${Date.now()}`,
              color: color ?? "#1447e6",
              description: description ?? null,
              organizationId: ctx.organizationId,
            },
            select: { id: true, name: true },
          });
          return {
            success: true,
            tagId: tag.id,
            summary: `Tag "${tag.name}" criada.`,
          };
        } catch (err) {
          if (
            err != null &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
          ) {
            return { error: `Já existe uma tag chamada "${name}".` };
          }
          return {
            error: err instanceof Error ? err.message : "Erro ao criar tag",
          };
        }
      },
    }),

    create_appointment: tool({
      description:
        "Cria um agendamento (Appointment) em uma agenda. Requer agendaId — obtenha via search_entities('agenda', ...). LeadId opcional — se o user mencionou um lead, busque o ID antes.",
      inputSchema: z.object({
        agendaId: z.string(),
        startsAt: z
          .string()
          .describe(
            "Data/hora ISO 8601 (ex: '2026-05-16T10:00:00-03:00'). Converta 'amanhã 10h' usando o fuso de São Paulo (-03:00).",
          ),
        durationMinutes: z.number().int().min(5).max(720).default(60),
        title: z.string().optional(),
        notes: z.string().optional(),
        leadId: z.string().optional(),
        meetingType: z.enum(["ONLINE", "IN_PERSON"]).default("ONLINE"),
      }),
      execute: async ({
        agendaId,
        startsAt,
        durationMinutes,
        title,
        notes,
        leadId,
        meetingType,
      }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        const agenda = await prisma.agenda.findFirst({
          where: { id: agendaId, organizationId: ctx.organizationId },
          select: { id: true, name: true },
        });
        if (!agenda) {
          return { error: `Agenda ${agendaId} não encontrada.` };
        }

        const start = new Date(startsAt);
        if (Number.isNaN(start.getTime())) {
          return {
            error: `Data inválida: "${startsAt}". Use formato ISO (ex: 2026-05-16T10:00:00-03:00).`,
          };
        }
        const end = new Date(start.getTime() + durationMinutes * 60_000);

        const appointment = await prisma.appointment.create({
          data: {
            agendaId: agenda.id,
            startsAt: start,
            endsAt: end,
            title: title ?? null,
            notes: notes ?? null,
            leadId: leadId ?? null,
            userId: ctx.userId,
            meetingType,
            status: "PENDING",
          },
          select: { id: true, title: true, startsAt: true },
        });

        return {
          success: true,
          appointmentId: appointment.id,
          summary: `Agendamento criado pra ${start.toLocaleString("pt-BR")} na agenda "${agenda.name}".`,
        };
      },
    }),
  };
}
