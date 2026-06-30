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
import { buildAnalyticsTools } from "@/features/astro/server/tools/analytics";
import { buildListTools } from "@/features/astro/server/tools/lists";
import { buildActionTools } from "@/features/astro/server/tools/actions";
import { buildMutationTools } from "@/features/astro/server/tools/mutations";
import { buildSearchTools } from "@/features/astro/server/tools/search";
import { buildChartTools } from "@/features/astro/server/tools/charts";
import { buildWorkflowTools } from "@/features/astro/server/tools/workflows";

/**
 * Modelo OpenAI — reaproveita a `OPENAI_API_KEY` que já é usada pelos
 * embeddings do RAG.
 *
 * Estratégia híbrida pra economizar tokens (regra de cobrança em Stars
 * já é fixa, então custo extra de modelo NÃO é repassado):
 *   - `gpt-4o-mini` (default): perguntas simples — criação direta, list
 *     única, get_* único, conversa curta.
 *   - `gpt-4o` (escalonado): perguntas complexas — multi-domínio (ex:
 *     "contratos E agendamentos com colaboradores"), comparações, ou
 *     conversas longas. O mini hesita em chamar tool em multi-domain.
 *
 * Override via env: `ASTRO_DEFAULT_MODEL=...` força o mesmo pra tudo.
 */
/**
 * Diretriz de estilo pro Astro via WhatsApp. Injetada no fim do system prompt
 * quando `outputStyle === "whatsapp"`. Mantém respostas diretas e sem a firula
 * de copiloto in-app (que fica estranha num chat de WhatsApp).
 */
const WHATSAPP_STYLE_PROMPT = `

[ESTILO WHATSAPP — OBRIGATÓRIO]
Você responde por WhatsApp. Tom DIRETO, objetivo e curto.
- Vá direto ao fato/número pedido. Sem rodeios, sem introduções ("Aqui está...", "Claro!").
- PROIBIDO encerrar com oferta de ajuda ou firula: nada de "se precisar, é só avisar", "espero ter ajudado", "qualquer dúvida estou à disposição", "quer que eu...". Termine na informação.
- NÃO sugira telas, rotas ou links do app (ex: "veja em /contatos") a menos que peçam explicitamente.
- Formatação WhatsApp: *negrito* com UM asterisco só. NUNCA use markdown (#, **, tabelas com |, blocos de código).
- Quando uma tool retornar lista/tabela, a lista JÁ é anexada automaticamente logo abaixo da sua resposta. NUNCA reescreva os itens (nada de "• Maria", "1. Pedro", nem rótulos tipo "Leads ativos:"). Responda no MÁXIMO uma frase curta de contexto — ou nada, se a lista fala por si.
- NÃO abra com saudação/lead-in ("Aqui estão...", "Segue...", "Claro!") e NÃO feche com oferta de ajuda. A última palavra deve ser a informação.
- Emojis: no máximo um, só quando agregar. Nada de setas decorativas (⬇️) apontando pra lista.`;

function modelFor(complexity: "simple" | "complex") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária para o ASTRO. " +
        "Adicione em .env.local e reinicie o `pnpm dev`.",
    );
  }
  const override = process.env.ASTRO_DEFAULT_MODEL;
  const id = override
    ? override
    : complexity === "complex"
      ? "gpt-4o"
      : "gpt-4o-mini";
  return openai(id);
}

/** Pra sub-agents (closer, task-agent, automation, etc) — mini é suficiente. */
function defaultModel() {
  return modelFor("simple");
}

/**
 * Heurística simples (zero LLM) pra classificar a pergunta. Conta sinais:
 * múltiplos domínios mencionados, conectivos ("e", "também", "com lista"),
 * comprimento. Erra pro lado simples — só escala pro 4o quando há
 * evidência clara de complexidade.
 */
function classifyComplexity(text: string): "simple" | "complex" {
  const lower = text.toLowerCase();

  // 1. Domínios mencionados — 2+ áreas distintas = complex.
  const domains = [
    /\b(contrato|forge|proposta)/,
    /\b(agendamento|agenda|reuni[ãa]o|compromisso|spacetime)/,
    /\b(lead|tracking|pipeline|funil)/,
    /\b(a[çc][ãa]o|tarefa|evento|workspace)/,
    /\b(conversa|chat|mensagem|whatsapp)/,
    /\b(financeiro|receita|despesa|saldo|inadimpl)/,
    /\b(integra[çc][ãa]o|meta\s*ads)/,
    /\b(nbox|storage|arquivo)/,
    /\b(linnker|bio\s*link)/,
    /\b(curso|nasa\s*route|aula|trilha)/,
    /\b(form[uú]l[áa]rio|submiss)/,
    /\b(insights?|relat[óo]rio)/,
  ];
  const domainHits = domains.filter((re) => re.test(lower)).length;
  if (domainHits >= 2) return "complex";

  // 2. Conectivos de pergunta múltipla / pedido visual.
  const multiQuestionSignals = [
    /\be\s+(quantos?|qual|quais|quanto|liste?|mostr)/,
    /\b(tamb[ée]m|junto\s+com)\b/,
    /\bcom\s+(a\s+)?lista\s+(d[eo]s?|de)\b/,
    /\bcompare?|comparar\b/,
    /\b(somat[óo]ria|total\s+de|m[ée]dia|ranking)/,
    // Pedidos de visualização — geralmente envolvem tool chart_* +
    // explicação contextualizada. Mini hesita; 4o resolve.
    /\b(gr[áa]fico|chart|visualiza|tend[êe]ncia|evolu[çc][ãa]o)\b/,
  ];
  if (multiQuestionSignals.some((re) => re.test(lower))) return "complex";

  // 3. Comprimento — perguntas muito longas tendem a ter contexto rico.
  if (lower.length > 200) return "complex";

  return "simple";
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
  // Injeta a data atual no system prompt do sub-agent — knowledge
  // cutoff do GPT-4o-mini é 2023 e ele inventa ano se não tiver
  // referência explícita.
  const todayIso = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .slice(0, 10);
  const nowSP = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  });
  const dateContext = `\n\n[CONTEXTO TEMPORAL]\nHoje é ${nowSP} (fuso SP, offset -03:00). ISO: ${todayIso}. Use SEMPRE o ano corrente (${todayIso.slice(0, 4)}) pra qualquer data.`;
  const { text } = await generateText({
    model: defaultModel(),
    system: `${agent.systemPrompt}${dateContext}`,
    tools: agent.buildTools(ctx),
    messages,
    stopWhen: ({ steps }) => steps.length >= 8,
    experimental_telemetry: {
      isEnabled: true,
      functionId: `astro-sub-agent-${agent.key}`,
      metadata: { posthog_distinct_id: ctx.userId },
    },
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
  /**
   * Escopo de tools expostas ao orquestrador.
   *   - "full" (default): comportamento in-app — leitura + mutação + sub-agents.
   *   - "insights": somente leitura (analytics/list/search/chart). Sem mutations,
   *     actions, workflows ou routing pra sub-agents (que escrevem). Usado pelo
   *     Astro via WhatsApp (Insights pelo WhatsApp), garantindo read-only de fato.
   */
  toolScope?: "full" | "insights";
  /**
   * Força o modelo "complex" (gpt-4o) ignorando a heurística de complexidade.
   * Usado pelo Astro via WhatsApp: o gpt-4o-mini hesita/alucina em tool-calls
   * ("não consegui acessar") em perguntas que exigem `list_*`. Volume baixo,
   * então priorizamos confiabilidade sobre custo de token.
   */
  forceComplexModel?: boolean;
  /**
   * Estilo de saída. "whatsapp" injeta diretriz de tom (direto, sem firula,
   * formatação WhatsApp, sem repetir listas que já vão anexadas).
   */
  outputStyle?: "default" | "whatsapp";
}) {
  const { ctx, uiMessages } = opts;
  const toolScope = opts.toolScope ?? "full";

  return (async () => {
    const enabled = await loadAgentEnabledMap(ctx.organizationId);

    // Pinned agent (embeds): pula o orquestrador, vai direto para o sub-agente.
    const modelMessages = await convertToModelMessages(uiMessages);

    if (ctx.pinnedAgentKey) {
      const pinned = getAgent(ctx.pinnedAgentKey);
      if (pinned && enabled[ctx.pinnedAgentKey]) {
        // Mesmo contexto temporal + route snapshot do path principal —
        // sem isso o sub-agent pinned (ex: Closer no copilot do
        // tracking-chat) não enxerga conversationId/leadId/trackingId
        // e responde "não consigo acessar a conversa".
        const nowSPpin = new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "full",
          timeStyle: "short",
        });
        const todayIsoPin = new Date()
          .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
          .slice(0, 10);
        const dateContextPin = `\n\n[CONTEXTO TEMPORAL]\nHoje é ${nowSPpin} (fuso América/São Paulo, offset -03:00). Data ISO: ${todayIsoPin}. Use SEMPRE o ano corrente (${todayIsoPin.slice(0, 4)}).`;
        return streamText({
          model: defaultModel(),
          system: `${pinned.systemPrompt}${buildRouteContextBlock(ctx.route)}${dateContextPin}`,
          tools: pinned.buildTools(ctx),
          messages: modelMessages,
          stopWhen: ({ steps }) => steps.length >= 8,
          experimental_telemetry: {
            isEnabled: true,
            functionId: `astro-pinned-${ctx.pinnedAgentKey}`,
            metadata: { posthog_distinct_id: ctx.userId },
          },
        });
      }
    }

    // Modo insights (WhatsApp): só leitura — sem routing pra sub-agents
    // (closer/task/automation escrevem). Modo full: routing normal.
    const routingTools =
      toolScope === "insights" ? {} : buildRoutingTools({ ctx, enabled });
    // Tools expostas direto no orchestrator (não passam por sub-agent).
    // Motivos:
    //   1. Sub-agent (generateText interno) consome outputs e devolve
    //      só texto — payloads `kind:"astro_table"` (list_*) e erros
    //      reais (create_*) viram prosa reescrita. Aqui os outputs
    //      viram tool-parts no stream, com semântica preservada.
    //   2. GPT-4o-mini tava hesitando em delegar/chamar e inventando
    //      "não consigo acessar" ou "tendo dificuldades". Com tools
    //      diretas, ele executa.
    //
    // INCLUI:
    //   - Leitura: analytics (get_*) + list_*
    //   - Mutação simples: create_action, create_appointment, create_lead,
    //     update_lead, etc — campos têm DEFAULTS server-side e o
    //     orchestrator basta passar os essenciais.
    //
    // FICA via route_to_*:
    //   - closer (sugestão de resposta com persona)
    //   - automation-agent (regra de alerta com cascata de slots)
    //   - search_entities encadeado complexo (task-agent ainda útil
    //     pra criar lead onde precisa procurar tracking, etc).
    // Modo insights: apenas tools de LEITURA (analytics + list + search +
    // chart). Mutations/actions/workflows ficam de fora — é o enforcement
    // real do read-only do Astro via WhatsApp (não um gate pós-execução).
    const readOnlyTools: ToolSet = {
      ...buildAnalyticsTools(ctx),
      ...buildListTools(ctx),
      // search_entities resolve nomes naturais ("Hulk", "agenda do Wey")
      // em IDs — também útil em leitura pra escopar listas/analytics.
      ...buildSearchTools(ctx),
      // chart_* — gráficos recharts (bar/line/pie) renderizados no client.
      ...buildChartTools(ctx),
    };
    const directTools: ToolSet =
      toolScope === "insights"
        ? readOnlyTools
        : {
            ...readOnlyTools,
            ...buildActionTools(ctx),
            ...buildMutationTools(ctx),
            // workflow_* — IA generativa de workflows agent-mode + apply preset
            // por slug. Use quando o user pede "cria uma automação que ..." ou
            // "aplica o preset de boas-vindas". Workflow nasce INATIVO no
            // canvas — Astro retorna link `editorUrl` pra user abrir e revisar.
            ...buildWorkflowTools(ctx),
          };
    const systemSuffix =
      toolScope === "insights" ? "" : buildAgentsBriefing(enabled);
    // Injeta a data/hora atual no system prompt pra o LLM resolver datas
    // relativas ("amanhã", "sexta") corretamente. GPT-4o-mini tem
    // knowledge cutoff antigo (2023) e tava inventando ano errado.
    const nowSP = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    });
    const todayIso = new Date()
      .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
      .slice(0, 10); // YYYY-MM-DD
    const dateContext = `\n\n[CONTEXTO TEMPORAL]\nHoje é ${nowSP} (fuso América/São Paulo, offset -03:00).\nData ISO de hoje: ${todayIso}.\nUse esta data como referência absoluta pra resolver "hoje", "amanhã", "sexta", etc. NUNCA invente ano — use SEMPRE o ano de hoje (${todayIso.slice(0, 4)}).`;

    // ── Roteamento de modelo (custo) ──
    // Classifica a última mensagem do user pra escolher entre mini e 4o.
    // - simple → gpt-4o-mini (barato, 5x mais barato no output)
    // - complex → gpt-4o (multi-domínio / multi-tool / comparações)
    // Override via env ASTRO_DEFAULT_MODEL ignora isso.
    const lastUserText = (() => {
      for (let i = uiMessages.length - 1; i >= 0; i--) {
        const m = uiMessages[i]!;
        if (m.role !== "user") continue;
        const parts = (m as { parts?: unknown[] }).parts ?? [];
        return parts
          .filter(
            (p): p is { type: string; text: string } =>
              typeof p === "object" &&
              p !== null &&
              (p as { type?: unknown }).type === "text" &&
              typeof (p as { text?: unknown }).text === "string",
          )
          .map((p) => p.text)
          .join(" ");
      }
      return "";
    })();
    const complexity = opts.forceComplexModel
      ? "complex"
      : classifyComplexity(lastUserText);
    console.log(
      `[ASTRO/orchestrator] model=${complexity === "complex" ? "gpt-4o" : "gpt-4o-mini"} (heur="${complexity}", forced=${opts.forceComplexModel ?? false}, text="${lastUserText.slice(0, 80)}")`,
    );

    const styleBlock =
      opts.outputStyle === "whatsapp" ? WHATSAPP_STYLE_PROMPT : "";

    return streamText({
      model: modelFor(complexity),
      system: `${ASTRO_ORCHESTRATOR_PROMPT}\n\n${systemSuffix}${buildRouteContextBlock(ctx.route)}${dateContext}${styleBlock}`,
      tools: { ...directTools, ...routingTools },
      messages: modelMessages,
      // Mais steps: orchestrator pode chamar várias tools de leitura
      // antes de responder (ex: get_tracking_overview + list_leads).
      stopWhen: ({ steps }) => steps.length >= 10,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "astro-orchestrator",
        metadata: { posthog_distinct_id: ctx.userId },
      },
    });
  })();
}

/**
 * Constrói um bloco de [CONTEXTO DA ROTA] com os IDs do snapshot do cliente.
 * Sem isso o LLM não conhece `leadId`/`conversationId` e tenta perguntar ao
 * usuário (ou alucina dizendo que não consegue acessar). Reusado por
 * orquestrador e sub-agentes pinned.
 */
function buildRouteContextBlock(
  route: AgentContext["route"] | undefined,
): string {
  if (!route) return "";
  const fields: Array<[string, string | undefined]> = [
    ["trackingId", route.trackingId],
    ["leadId", route.leadId],
    ["conversationId", route.conversationId],
    ["workspaceId", route.workspaceId],
    ["actionId", route.actionId],
    ["pathname", route.pathname],
  ];
  const lines = fields
    .filter(([, v]) => typeof v === "string" && v.length > 0)
    .map(([k, v]) => `- ${k}: ${v}`);
  if (lines.length === 0) return "";
  return `\n\n[CONTEXTO DA ROTA]\nO usuário está vendo esta tela agora. Use estes IDs DIRETAMENTE como input das tools — NÃO pergunte ao usuário e NÃO invente outros:\n${lines.join("\n")}`;
}

function buildAgentsBriefing(enabled: Record<AgentKey, boolean>) {
  const lines = AGENTS.filter((a) => enabled[a.key]).map(
    (a) =>
      `- **${a.displayName}** (\`route_to_${a.key.replace(/-/g, "_")}\`): ${a.shortDescription}`,
  );
  return `Sub-agentes disponíveis:\n${lines.join("\n")}`;
}
