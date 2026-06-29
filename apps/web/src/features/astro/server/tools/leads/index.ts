import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  userCanAccessLead,
  userBelongsToOrg,
} from "@/features/astro/server/tools/_shared/permissions";
import type { AstroTagSuggestionsPayload } from "@/features/astro/lib/astro-tag-suggestions";

/**
 * Tools de leads para o sub-agente Closer (e ASTRO quando perguntado direto).
 * Todas validam acesso pelo `userId` da AgentContext — nunca confiar no input.
 */
export function buildLeadTools(ctx: AgentContext) {
  return {
    search_lead: tool({
      description:
        "Busca leads da organização atual por nome ou telefone. Retorna no máximo 10 resultados.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Trecho do nome ou telefone"),
      }),
      execute: async ({ query }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const leads = await prisma.lead.findMany({
          where: {
            tracking: { organizationId: ctx.organizationId },
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 10,
          select: {
            id: true,
            name: true,
            phone: true,
            temperature: true,
            tracking: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        });
        return { leads };
      },
    }),

    get_conversation: tool({
      description:
        "Retorna o histórico recente de mensagens de uma conversa do tracking-chat (até 50 mensagens, ordem cronológica). Passe `sinceDays` pra limitar ao período N dias atrás (útil pra análise de conversa recente, ex.: propor tags).",
      inputSchema: z.object({
        conversationId: z.string(),
        sinceDays: z
          .number()
          .int()
          .positive()
          .max(30)
          .optional()
          .describe(
            "Se passado, filtra mensagens dos últimos N dias (máx 30).",
          ),
      }),
      execute: async ({ conversationId, sinceDays }) => {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            tracking: { select: { organizationId: true } },
            lead: { select: { id: true, name: true } },
          },
        });
        if (!conv) return { error: "Conversa não encontrada" };
        if (
          !(await userBelongsToOrg(ctx.userId, conv.tracking.organizationId))
        ) {
          return { error: "Sem acesso à conversa" };
        }
        const since = sinceDays
          ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
          : undefined;
        const messages = await prisma.message.findMany({
          where: {
            conversationId,
            ...(since ? { createdAt: { gte: since } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            body: true,
            fromMe: true,
            mediaType: true,
            createdAt: true,
          },
        });
        return {
          conversationId,
          lead: conv.lead,
          sinceDays: sinceDays ?? null,
          messages: messages.reverse(), // cronológico
        };
      },
    }),

    update_lead_tags: tool({
      description:
        "Adiciona ou remove tags de um lead. `add` e `remove` são listas de IDs de tags.",
      inputSchema: z.object({
        leadId: z.string(),
        add: z.array(z.string()).default([]),
        remove: z.array(z.string()).default([]),
      }),
      execute: async ({ leadId, add, remove }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso ao lead" };
        }
        if (add.length > 0) {
          await prisma.leadTag.createMany({
            data: add.map((tagId) => ({ leadId, tagId })),
            skipDuplicates: true,
          });
        }
        if (remove.length > 0) {
          await prisma.leadTag.deleteMany({
            where: { leadId, tagId: { in: remove } },
          });
        }
        return { ok: true, added: add.length, removed: remove.length };
      },
    }),

    list_taggable_tags: tool({
      description:
        "Lista as tags com `description` preenchida disponíveis pro tracking do lead (org-scoped + tracking-scoped) e as tags que o lead já possui. Use antes de `propose_tags_for_lead` pra escolher do catálogo correto e evitar duplicar tag que o lead já tem.",
      inputSchema: z.object({ leadId: z.string() }),
      execute: async ({ leadId }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso ao lead" };
        }
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            trackingId: true,
            tracking: { select: { organizationId: true } },
            leadTags: { select: { tagId: true } },
          },
        });
        if (!lead?.tracking) return { error: "Lead sem tracking" };
        const available = await prisma.tag.findMany({
          where: {
            organizationId: lead.tracking.organizationId,
            OR: [{ trackingId: lead.trackingId }, { trackingId: null }],
            description: { not: null },
          },
          select: { id: true, name: true, description: true },
          orderBy: { name: "asc" },
        });
        return {
          available,
          current: lead.leadTags.map((lt) => lt.tagId),
        };
      },
    }),

    propose_tags_for_lead: tool({
      description:
        "Apresenta sugestões de tags pro usuário revisar e aplicar via UI interativa. Use SEMPRE depois de `list_taggable_tags` + `get_conversation` (com `sinceDays: 7`). Cada sugestão precisa de um `reason` curto (1 frase) justificando com base em sinais concretos da conversa. NÃO escreva prosa descrevendo as tags depois — o card já mostra tudo.",
      inputSchema: z.object({
        leadId: z.string(),
        suggestions: z
          .array(
            z.object({
              tagId: z.string(),
              reason: z.string().min(3).max(140),
            }),
          )
          .min(1)
          .max(5),
      }),
      execute: async ({ leadId, suggestions }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso ao lead" };
        }
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            trackingId: true,
            tracking: { select: { organizationId: true } },
            leadTags: { select: { tagId: true } },
          },
        });
        if (!lead?.tracking || !lead.trackingId) {
          return { error: "Lead sem tracking" };
        }
        const inputTagIds = suggestions.map((s) => s.tagId);
        const tags = await prisma.tag.findMany({
          where: {
            id: { in: inputTagIds },
            organizationId: lead.tracking.organizationId,
            OR: [{ trackingId: lead.trackingId }, { trackingId: null }],
            description: { not: null },
          },
          select: { id: true, name: true, color: true },
        });
        const tagsById = new Map(tags.map((t) => [t.id, t] as const));
        const currentTagIds = new Set(lead.leadTags.map((lt) => lt.tagId));

        const hydrated: AstroTagSuggestionsPayload["suggestions"] = [];
        const skipped: NonNullable<AstroTagSuggestionsPayload["skipped"]> = [];

        for (const s of suggestions) {
          const tag = tagsById.get(s.tagId);
          if (!tag) {
            skipped.push({ tagId: s.tagId, reason: "not_in_catalog" });
            continue;
          }
          if (currentTagIds.has(s.tagId)) {
            skipped.push({ tagId: s.tagId, reason: "already_applied" });
            continue;
          }
          hydrated.push({
            tagId: tag.id,
            tagName: tag.name,
            tagColor: tag.color ?? undefined,
            reason: s.reason,
          });
        }

        const payload: AstroTagSuggestionsPayload = {
          kind: "astro_tag_suggestions",
          leadId,
          trackingId: lead.trackingId,
          suggestions: hydrated,
          skipped: skipped.length > 0 ? skipped : undefined,
        };
        return payload;
      },
    }),
  };
}
