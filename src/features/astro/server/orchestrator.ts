import "server-only";
import {
  generateText,
  streamText,
  tool,
  convertToModelMessages,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ASTRO_ORCHESTRATOR_PROMPT } from "@/features/astro/lib/prompts";
import {
  AGENTS,
  getAgent,
} from "@/features/astro/server/agents/registry";
import type { AgentDefinition } from "@/features/astro/server/agents/types";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AgentKey } from "@/features/astro/schemas/agent-config";

/**
 * Modelo default — OpenAI. Reaproveita a `OPENAI_API_KEY` que já é usada
 * pelos embeddings do RAG. Pode ser sobrescrito por `ASTRO_DEFAULT_MODEL` no
 * env (ex: `gpt-4o`, `gpt-4.1-mini`, `gpt-5`, etc).
 */
function defaultModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária para o ASTRO. " +
        "Adicione em .env.local e reinicie o `pnpm dev`.",
    );
  }
  const id = process.env.ASTRO_DEFAULT_MODEL ?? "gpt-4o-mini";
  return openai(id);
}

/**
 * Carrega o map de `enabled` por agentKey para a organização — usado para
 * filtrar quais sub-agentes o orquestrador pode delegar.
 */
async function loadAgentEnabledMap(
  organizationId: string,
): Promise<Record<AgentKey, boolean>> {
  const configs = await prisma.aiAgentConfig.findMany({
    where: { organizationId },
    select: { agentKey: true, enabled: true },
  });
  const map: Record<string, boolean> = {};
  for (const a of AGENTS) map[a.key] = true; // default ligado
  for (const c of configs) map[c.agentKey] = c.enabled;
  return map as Record<AgentKey, boolean>;
}

/**
 * Para cada sub-agente habilitado, gera uma tool `route_to_<key>` no
 * orquestrador. A tool delega para `runSubAgent` (generateText em loop fechado
 * sobre as tools daquele sub-agente) e devolve o texto final.
 */
function buildRoutingTools(opts: {
  ctx: AgentContext;
  enabled: Record<AgentKey, boolean>;
}) {
  const tools: ToolSet = {};
  for (const agent of AGENTS) {
    if (!opts.enabled[agent.key]) continue;
    tools[`route_to_${agent.key.replace(/-/g, "_")}`] = tool({
      description: `Delega para o sub-agente ${agent.displayName}. ${agent.shortDescription}`,
      inputSchema: z.object({
        instruction: z
          .string()
          .min(1)
          .describe(
            "Instrução em linguagem natural do que o sub-agente deve fazer, com todo o contexto necessário (IDs, dados que você já obteve, etc).",
          ),
      }),
      execute: async ({ instruction }) => {
        const result = await runSubAgent({
          agent,
          ctx: opts.ctx,
          instruction,
        });
        return { result };
      },
    });
  }
  return tools;
}

/**
 * Executa um sub-agente como um `generateText` interno, com seu próprio
 * system prompt e suas tools. O orquestrador recebe apenas o texto final.
 *
 * `stopWhen` permite múltiplas rodadas de tool-call dentro do sub-agente.
 */
async function runSubAgent(opts: {
  agent: AgentDefinition;
  ctx: AgentContext;
  instruction: string;
}): Promise<string> {
  const { agent, ctx, instruction } = opts;
  const messages: ModelMessage[] = [
    { role: "user", content: instruction },
  ];
  const { text } = await generateText({
    model: defaultModel(),
    system: agent.systemPrompt,
    tools: agent.buildTools(ctx),
    messages,
    // limite generoso de passos pra permitir tool-calls encadeados
    stopWhen: ({ steps }) => steps.length >= 8,
  });
  return text;
}

/**
 * Streamer principal do ASTRO. O route handler chama esta função e devolve
 * `result.toUIMessageStreamResponse()`. `onFinish` é responsabilidade do
 * caller (precisa do `sessionId` para persistir).
 */
export function streamAstro(opts: {
  ctx: AgentContext;
  uiMessages: UIMessage[];
}) {
  const { ctx, uiMessages } = opts;

  return (async () => {
    const enabled = await loadAgentEnabledMap(ctx.organizationId);

    // Pinned agent (embeds): pula o orquestrador, vai direto para o sub-agente.
    const modelMessages = await convertToModelMessages(uiMessages);

    if (ctx.pinnedAgentKey) {
      const pinned = getAgent(ctx.pinnedAgentKey);
      if (pinned && enabled[ctx.pinnedAgentKey]) {
        return streamText({
          model: defaultModel(),
          system: pinned.systemPrompt,
          tools: pinned.buildTools(ctx),
          messages: modelMessages,
          stopWhen: ({ steps }) => steps.length >= 8,
        });
      }
    }

    const routingTools = buildRoutingTools({ ctx, enabled });
    const systemSuffix = buildAgentsBriefing(enabled);

    return streamText({
      model: defaultModel(),
      system: `${ASTRO_ORCHESTRATOR_PROMPT}\n\n${systemSuffix}`,
      tools: routingTools,
      messages: modelMessages,
      stopWhen: ({ steps }) => steps.length >= 6,
    });
  })();
}

function buildAgentsBriefing(enabled: Record<AgentKey, boolean>) {
  const lines = AGENTS.filter((a) => enabled[a.key]).map(
    (a) =>
      `- **${a.displayName}** (\`route_to_${a.key.replace(/-/g, "_")}\`): ${a.shortDescription}`,
  );
  return `Sub-agentes disponíveis:\n${lines.join("\n")}`;
}
