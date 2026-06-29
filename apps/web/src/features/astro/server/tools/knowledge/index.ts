import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { searchKnowledge } from "@/features/astro/server/rag/retriever";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AgentKey } from "@/features/astro/schemas/agent-config";

/**
 * Tool de RAG. Antes de buscar, resolve `knowledgeIds` permitidos para o
 * agente atual via `AiAgentConfig`. Se nenhuma KB foi vinculada, busca em
 * todas as `AiKnowledge` da organização (comportamento padrão do MVP).
 */
export function buildKnowledgeTools(
  ctx: AgentContext,
  agentKey: AgentKey,
) {
  return {
    search_knowledge: tool({
      description:
        "Busca trechos relevantes na base de conhecimento da empresa (PDFs, planilhas, docs). Use ANTES de responder qualquer dúvida factual sobre produto, processo ou conteúdo do usuário. Retorna chunks com nome do documento e trecho.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe("Pergunta ou termo natural — não use IDs"),
        topK: z.number().min(1).max(10).default(5),
      }),
      execute: async ({ query, topK }) => {
        const config = await prisma.aiAgentConfig.findUnique({
          where: {
            organizationId_agentKey: {
              organizationId: ctx.organizationId,
              agentKey,
            },
          },
          select: { knowledgeIds: true },
        });
        const chunks = await searchKnowledge({
          organizationId: ctx.organizationId,
          query,
          knowledgeIds: config?.knowledgeIds?.length
            ? config.knowledgeIds
            : undefined,
          topK,
        });
        return { chunks };
      },
    }),
  };
}
