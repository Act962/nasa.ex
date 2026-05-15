import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  userBelongsToOrg,
  userCanAccessLead,
} from "@/features/astro/server/tools/_shared/permissions";

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

    update_lead: tool({
      description:
        "Atualiza dados de um lead existente. Use leadId obtido via search_entities. Só passe os campos que vai mudar.",
      inputSchema: z.object({
        leadId: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        document: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ leadId, ...patch }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso a esse lead" };
        }
        // Remove undefined pra não sobrescrever com null
        const data = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(data).length === 0) {
          return { error: "Nada pra atualizar — informe ao menos um campo." };
        }
        const updated = await prisma.lead.update({
          where: { id: leadId },
          data,
          select: { id: true, name: true },
        });
        return {
          success: true,
          summary: `Lead "${updated.name}" atualizado.`,
        };
      },
    }),

    move_lead: tool({
      description:
        "Move um lead pra outro status (dentro do mesmo tracking). Use statusId obtido via search_entities('status', …).",
      inputSchema: z.object({
        leadId: z.string(),
        toStatusId: z.string(),
      }),
      execute: async ({ leadId, toStatusId }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso a esse lead" };
        }
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { id: true, name: true, statusId: true, trackingId: true },
        });
        if (!lead) return { error: "Lead não encontrado" };
        const status = await prisma.status.findUnique({
          where: { id: toStatusId },
          select: { id: true, name: true, trackingId: true },
        });
        if (!status) return { error: "Status alvo não encontrado" };
        if (status.trackingId !== lead.trackingId) {
          return {
            error:
              "Esse status pertence a outro tracking. Use move dentro do mesmo funil ou search_entities pra achar status do tracking certo.",
          };
        }
        if (lead.statusId === toStatusId) {
          return { error: `Lead já está em "${status.name}".` };
        }
        await prisma.lead.update({
          where: { id: leadId },
          data: { statusId: toStatusId },
        });
        return {
          success: true,
          summary: `"${lead.name}" movido pra "${status.name}".`,
        };
      },
    }),

    send_whatsapp_message: tool({
      description:
        "Envia mensagem de WhatsApp pro lead via instância conectada da org. Usa o telefone do lead. CONFIRME O TEXTO COM O USUÁRIO ANTES — mensagem cai direto pro cliente.",
      inputSchema: z.object({
        leadId: z.string(),
        text: z.string().min(1).max(1500),
      }),
      execute: async ({ leadId, text }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso a esse lead" };
        }
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            name: true,
            phone: true,
            tracking: {
              select: {
                organizationId: true,
                whatsappInstance: {
                  select: { apiKey: true, baseUrl: true, status: true },
                },
              },
            },
          },
        });
        if (!lead) return { error: "Lead não encontrado" };
        if (!lead.phone) {
          return { error: `"${lead.name}" não tem telefone cadastrado.` };
        }
        const inst = lead.tracking?.whatsappInstance;
        if (!inst || inst.status !== "CONNECTED") {
          return {
            error:
              "WhatsApp não está conectado no tracking desse lead. Conecte em /integrations e tente de novo.",
          };
        }
        try {
          await sendText(
            inst.apiKey,
            { number: lead.phone, text },
            inst.baseUrl,
          );
          return {
            success: true,
            summary: `Mensagem enviada pro WhatsApp de "${lead.name}".`,
          };
        } catch (err) {
          return {
            error:
              err instanceof Error
                ? `Falha no envio: ${err.message}`
                : "Erro ao enviar WhatsApp",
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
