import "server-only";
import { TASK_AGENT_PROMPT } from "@/features/astro/lib/prompts";
import { buildActionTools } from "@/features/astro/server/tools/actions";
import { buildKnowledgeTools } from "@/features/astro/server/tools/knowledge";
import { buildSearchTools } from "@/features/astro/server/tools/search";
import { buildMutationTools } from "@/features/astro/server/tools/mutations";
import type { AgentDefinition } from "./types";

export const taskAgent: AgentDefinition = {
  key: "task-agent",
  displayName: "Task Agent",
  shortDescription:
    "Cria Leads, Tags, Actions/eventos, SubActions, Reminders e Appointments. Antes de delegar, garanta que o user já informou os ESSENCIAIS de cada tipo: action/evento = título + data; agendamento = lead + data/horário; lead = nome + telefone. Demais campos (descrição, prioridade, responsável, projeto, etc) NÃO perguntar — defaults preenchem ou ficam vazios pro user editar depois.",
  systemPrompt: TASK_AGENT_PROMPT,
  buildTools: (ctx) => ({
    ...buildActionTools(ctx),
    ...buildMutationTools(ctx),
    ...buildSearchTools(ctx),
    ...buildKnowledgeTools(ctx, "task-agent"),
  }),
};
