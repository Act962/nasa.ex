import "server-only";
import { TASK_AGENT_PROMPT } from "@/features/astro/lib/prompts";
import { buildActionTools } from "@/features/astro/server/tools/actions";
import { buildKnowledgeTools } from "@/features/astro/server/tools/knowledge";
import { buildSearchTools } from "@/features/astro/server/tools/search";
import type { AgentDefinition } from "./types";

export const taskAgent: AgentDefinition = {
  key: "task-agent",
  displayName: "Task Agent",
  shortDescription:
    "Cria Actions, SubActions, Reminders e Appointments a partir de instrução em linguagem natural.",
  systemPrompt: TASK_AGENT_PROMPT,
  buildTools: (ctx) => ({
    ...buildActionTools(ctx),
    ...buildSearchTools(ctx),
    ...buildKnowledgeTools(ctx, "task-agent"),
  }),
};
