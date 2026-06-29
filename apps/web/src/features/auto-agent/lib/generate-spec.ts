/**
 * Traduz pedido em linguagem natural (rawPrompt + systemInstructions) em
 * `AgentSpec` JSON executável via Astro/LLM.
 *
 * Fluxo:
 *  1. Concatena rawPrompt + systemInstructions em um único prompt
 *  2. Envia pra LLM com system prompt meta-especializado
 *  3. LLM retorna JSON estrito
 *  4. Valida via Zod (agentSpecSchema)
 *  5. Se inválido, retorna `{ ok: false, errors }` pro user editar
 *
 * IMPORTANTE — Fase 1 stub: nesse arquivo só montamos o prompt e validamos.
 * A invocação real do LLM (provider Anthropic/OpenAI/Gemini) fica delegada
 * ao adapter existente do projeto (a integrar na Fase 2 com astro/lib/llm).
 */

import { agentSpecSchema, type AgentSpec } from "./agent-spec.schema";

export type GenerateSpecInput = {
  /// Pedido inicial do user em PT-BR ("Quero que ao receber tag X envie...")
  rawPrompt: string;
  /// Manual da IA — tom de voz, restrições, info da empresa
  systemInstructions: string;
  /// Contexto da org pra IA usar (tags existentes, status, produtos, etc)
  orgContext?: {
    availableTags?: Array<{ name: string; slug: string }>;
    availableStatuses?: Array<{ name: string; slug: string }>;
    availableProducts?: Array<{ name: string; id: string }>;
  };
};

export type GenerateSpecResult =
  | { ok: true; spec: AgentSpec }
  | {
      ok: false;
      errors: Array<{ path: string; message: string }>;
      /// Se faltou info crítica que LLM não conseguiu inferir, pergunta de volta
      needsClarification?: string[];
      /// Spec parcial gerada (mesmo inválida — útil pro user editar)
      partialSpec?: unknown;
    };

/**
 * Monta o system prompt meta-especializado pra LLM tradutora.
 * Inclui specs de tools disponíveis pra que ela escolha somente os corretos.
 */
function buildMetaSystemPrompt(orgContext?: GenerateSpecInput["orgContext"]): string {
  const availableTools = [
    "sendMessage",
    "addTagsToLead",
    "moveLeadToStatus",
    "moveLeadToTracking",
    "sendForm",
    "sendAgenda",
    "sendProposal",
    "sendContract",
    "sendLinnker",
    "sendNasaRoute",
    "transferToHuman",
    "markGoalAchieved",
  ];

  let prompt = `Você traduz instruções em linguagem natural pra "AgentSpec" JSON.

Recebe DOIS inputs:
  1. rawPrompt — pedido do user (o QUE o agente deve fazer)
  2. systemInstructions — manual da IA (COMO se comportar; vira contexto runtime)

Use o rawPrompt pra extrair GOALS (objetivos sequenciais) + transições.
Use o systemInstructions pra inferir stopWords e restrições éticas.

Tools disponíveis: ${availableTools.join(", ")}

Cada GOAL deve ter:
- id (kebab-case curto)
- name (humano)
- completionCriteria (texto natural avaliado em cada turno: "lead aceitou", "lead escolheu opção A")
- allowedTools (subset dos disponíveis)
- initialMessage (opcional — primeira ação)
- onSuccess / onFailure (id do próximo goal, ou null pra fim)

Retorne JSON estrito:
{
  "goals": [...],
  "contextVars": ["..."],
  "stopWords": ["..."] (opcional)
}

Se faltar info crítica (qual produto enviar, qual proposta), retorne:
{ "needsClarification": ["Qual produto vai ser enviado na proposta?"] }`;

  if (orgContext) {
    prompt += `\n\nContexto da org:`;
    if (orgContext.availableTags?.length) {
      prompt += `\n- Tags existentes: ${orgContext.availableTags.map((t) => t.name).join(", ")}`;
    }
    if (orgContext.availableStatuses?.length) {
      prompt += `\n- Status existentes: ${orgContext.availableStatuses.map((s) => s.name).join(", ")}`;
    }
    if (orgContext.availableProducts?.length) {
      prompt += `\n- Produtos disponíveis: ${orgContext.availableProducts.map((p) => p.name).join(", ")}`;
    }
  }

  return prompt;
}

/**
 * Stub Fase 1: aceita JSON manual do user (no editor da UI) e valida.
 * Fase 2 vai conectar com Astro/LLM pra chamar o provider real.
 */
export function validateGeneratedSpec(rawJson: unknown): GenerateSpecResult {
  const parsed = agentSpecSchema.safeParse(rawJson);
  if (parsed.success) {
    return { ok: true, spec: parsed.data };
  }
  const errors = parsed.error.issues.map((iss) => ({
    path: iss.path.join("."),
    message: iss.message,
  }));
  return { ok: false, errors, partialSpec: rawJson };
}

/**
 * Façade futura — Fase 2 conecta com Astro provider real.
 * Por enquanto retorna stub vazio pra TypeScript compilar; será preenchido.
 */
export async function generateAgentSpec(
  input: GenerateSpecInput,
): Promise<GenerateSpecResult> {
  // TODO Fase 2: chamar Astro com buildMetaSystemPrompt + rawPrompt + systemInstructions
  // Por enquanto retorna spec vazia pra dev poder seguir UI.
  const stub: AgentSpec = {
    goals: [
      {
        id: "default",
        name: "Atendimento padrão",
        completionCriteria: "lead respondeu ou recusou",
        allowedTools: ["sendMessage", "transferToHuman"],
      },
    ],
    contextVars: [],
  };
  return { ok: true, spec: stub };
}

export { buildMetaSystemPrompt };
