import "server-only";
import { CLOSER_PROMPT } from "@/features/astro/lib/prompts";
import { buildLeadTools } from "@/features/astro/server/tools/leads";
import { buildKnowledgeTools } from "@/features/astro/server/tools/knowledge";
import type { AgentDefinition } from "./types";

export const closerAgent: AgentDefinition = {
  key: "closer",
  displayName: "Closer",
  shortDescription:
    "Especialista em fechamento de leads, conversão e quebra de objeções. Lê conversas, sugere respostas, propõe tags.",
  systemPrompt: CLOSER_PROMPT,
  buildTools: (ctx) => ({
    ...buildLeadTools(ctx),
    ...buildKnowledgeTools(ctx, "closer"),
  }),
};
