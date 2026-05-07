import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  userCanAccessLead,
  userBelongsToOrg,
} from "@/features/astro/server/tools/_shared/permissions";

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
        "Retorna o histórico recente de mensagens de uma conversa do tracking-chat (até 50 mensagens, ordem cronológica).",
      inputSchema: z.object({
        conversationId: z.string(),
      }),
      execute: async ({ conversationId }) => {
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
        const messages = await prisma.message.findMany({
          where: { conversationId },
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
  };
}
