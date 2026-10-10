import "server-only";
import { z } from "zod";
import type { ToolSet } from "ai";
import prisma from "@/lib/prisma";
import { resolveVoiceModel } from "@/features/astro/server/voice/build-voice-session-config";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";
import { ensureLeadConversation } from "@/features/tracking-executions/lib/send-template-to-lead";
import { loadAgentContext } from "@/features/tracking-chat-ai/lib/context";
import { buildSystemPrompt } from "@/features/tracking-chat-ai/lib/system-prompt";
import { loadAttendanceKnowledgeBlock } from "@/features/tracking-chat-ai/lib/attendance-knowledge";
import { buildAgentTools } from "@/features/tracking-chat-ai/server/tools";
import { findBotVoice } from "../voice/voices";
import { findOrCreateCallerLead } from "./call-record";
import type { CallInstance, ClientCallPersona } from "./call-session";

/**
 * Cliente liga e o Astro atende (spec 0087, Parte C). É o mesmo agente do atendimento por texto
 * (spec 0084): mesmo prompt da empresa, mesmas capacidades ligadas no tracking e as mesmas
 * ferramentas, todas presas ao lead do número que ligou. A voz não ganha nada a mais.
 */

const DEFAULT_MAX_CALLS_PER_HOUR = 6;

/** Em teste, o mesmo número liga muitas vezes seguidas: `ASTRO_WHATSAPP_CALLS_MAX_PER_HOUR` sobe o limite sem mudar o padrão. */
function resolveMaxCallsPerHour(): number {
  const configured = Number(process.env.ASTRO_WHATSAPP_CALLS_MAX_PER_HOUR);
  return Number.isInteger(configured) && configured > 0 && configured <= 60 ? configured : DEFAULT_MAX_CALLS_PER_HOUR;
}
const HOUR_MS = 60 * 60_000;
const MAX_COMPANY_KNOWLEDGE_CHARS = 24_000;
const URL_IN_TOOL_OUTPUT = /https?:\/\/[^\s"'\\<>)]+/g;
const LINK_SENT_NOTE = "[link enviado por mensagem no WhatsApp: avise que mandou por mensagem, não leia endereço]";
const SEND_LINK_TOOL_NAME = "send_link_by_message";
const TOOL_OUTPUT_LIMIT = 4000;
/** Mandam mídia ou botão pelo WhatsApp: não fazem sentido no meio de uma ligação. */
const TOOLS_NOT_FOR_VOICE = new Set(["send_audio", "send_document", "send_buttons"]);
/** A voz em tempo real só tem estas vozes das que a empresa pode escolher; as demais caem na padrão. */
const REALTIME_VOICES = new Set(["cedar", "marin"]);
const DEFAULT_REALTIME_VOICE = "cedar";

const VOICE_RULES = [
  "## Você está numa LIGAÇÃO de voz, não numa conversa escrita",
  "- Fale em português do Brasil, com naturalidade, em frases curtas: uma a três por vez. Ignore as regras de formatação de mensagem escritas acima.",
  "- Nunca leia link, código, PIX, endereço de site ou identificador. Se precisar passar um link ou o PIX, diga que vai mandar por mensagem aqui no WhatsApp.",
  "- Diga no máximo quatro horários por vez e pergunte qual a pessoa prefere.",
  "- Datas e horas faladas por extenso: \"segunda, dia doze, às nove da manhã\".",
  "- Telefone, valor ou data ditados em partes: espere terminar, repita e confirme antes de agir.",
  "- Só diga que algo foi marcado, cancelado ou registrado quando a ferramenta confirmar. Se a ferramenta pedir mais dados, pergunte.",
  "- Horários: diga só a hora de início (\"às nove\", \"nove e meia\"), no máximo quatro por vez.",
  "- Link nunca é falado. Quando uma ferramenta devolver um link, ele já foi enviado por mensagem: diga apenas que mandou por mensagem. Se a pessoa pedir um link da empresa, use `send_link_by_message`.",
  "- Só diga que registrou, ou que vai registrar, um pedido para a equipe se usar `register_team_request` na mesma hora. Colocar uma tag não é registrar pedido.",
  "- Antes de dizer que vai confirmar com a equipe, procure a resposta nas informações da empresa: listas (convênios, exames, unidades) valem como resposta.",
  "- Pergunta sobre uma lista (convênios, exames, serviços, unidades): responda citando até cinco itens da lista e pergunte se a pessoa quer saber de algum em especial. Item que está na lista é resposta certa: não abra pedido para a equipe para \"confirmar\".",
  "- Antes de consultar horários, repita a unidade ou a agenda que a pessoa disse. Se ela não disse, pergunte. Nunca troque a unidade por conta própria.",
  "- Agradecimento ou despedida (\"obrigado\", \"era só isso\", \"tchau\"): despeça-se em uma frase e não ofereça nem prometa mais nada.",
  "- Quando o assunto da pessoa casar com uma tag disponível, aplique com `add_tags_to_lead` sem comentar.",
  "- Depois de se apresentar, fique em silêncio até a pessoa falar. Se ela se despedir, despeça-se em uma frase.",
].join("\n");

function toRealtimeTools(tools: ToolSet) {
  return Object.entries(tools)
    .filter(([toolName]) => !TOOLS_NOT_FOR_VOICE.has(toolName))
    .map(([toolName, definition]) => {
      const inputSchema = (definition as { inputSchema?: unknown }).inputSchema;
      let parameters: Record<string, unknown> = { type: "object", properties: {} };
      try {
        if (inputSchema instanceof z.ZodType) {
          const { $schema: _schemaUrl, ...jsonSchema } = z.toJSONSchema(inputSchema) as Record<string, unknown>;
          parameters = jsonSchema;
        }
      } catch {
        // Esquema que não converte fica sem parâmetros: a ferramenta ainda valida a entrada ao executar.
      }
      return {
        type: "function",
        name: toolName,
        description: String((definition as { description?: string }).description ?? "").slice(0, 900),
        parameters,
      };
    });
}

/** Texto que acompanha a ligação (link, confirmação). Fica no chat como qualquer mensagem da assistente. */
async function sendCallCompanionText(params: {
  trackingId: string;
  leadId: string;
  leadPhone: string;
  conversationId: string;
  senderName: string;
  text: string;
}): Promise<void> {
  const resolved = await resolveOutboundProvider(params.trackingId);
  const sent = await resolved.provider.sendText({ kind: "text", to: params.leadPhone, body: params.text, typingDelayMs: 0 });
  await persistOutboundMessage({
    conversationId: params.conversationId,
    leadId: params.leadId,
    trackingId: params.trackingId,
    body: params.text,
    senderName: params.senderName,
    externalMessageId: sent.externalMessageId,
  });
}

const SLOTS_TOOL_NAME = "get_available_slots";
const MAX_SPOKEN_SLOTS = 4;

/** Faixa de horário ("08:00 às 08:30") lida em voz alta cansa: a voz recebe só a hora de início, quatro por vez. */
function toSpokenSlots(output: unknown): unknown {
  if (!output || typeof output !== "object") return output ?? {};
  const slots = (output as { slots?: unknown }).slots;
  if (!Array.isArray(slots)) return output;
  const startTimes = slots
    .map((slot) => (slot && typeof slot === "object" ? (slot as { startTime?: unknown }).startTime : slot))
    .filter((startTime): startTime is string => typeof startTime === "string");
  return {
    ...(output as Record<string, unknown>),
    slots: startTimes.slice(0, MAX_SPOKEN_SLOTS),
    otherFreeTimes: startTimes.slice(MAX_SPOKEN_SLOTS),
    note: "Diga só os horários de `slots`. Se a pessoa quiser outro, veja em `otherFreeTimes`.",
  };
}

export type ClientCallDecision =
  | { canAnswer: true; persona: ClientCallPersona }
  | { canAnswer: false; reason: string; shouldSendTextOnlyNotice: boolean };

/** Decide se a chamada de um cliente é atendida e monta a sessão de voz dele. */
export async function prepareClientCall(params: { instance: CallInstance; callerPhone: string }): Promise<ClientCallDecision> {
  const { instance } = params;
  const lead = await findOrCreateCallerLead({ trackingId: instance.trackingId, callerPhone: params.callerPhone, callerName: null });
  if (!lead) return { canAnswer: false, reason: "no_funnel_stage", shouldSendTextOnlyNotice: false };

  const conversationId = await ensureLeadConversation(instance.trackingId, { id: lead.id, phone: lead.phone });
  const agentContext = await loadAgentContext({
    trackingId: instance.trackingId,
    leadId: lead.id,
    conversationId,
    organizationId: instance.organizationId,
  } as Parameters<typeof loadAgentContext>[0]);
  // Negar por padrão: sem o Chatbot IA configurado ou sem a opção ligada, o cliente é atendido só por mensagem.
  if (!agentContext.settings || !agentContext.capabilities.voiceCall) {
    return { canAnswer: false, reason: "voice_call_disabled", shouldSendTextOnlyNotice: true };
  }
  if (!agentContext.lead.isActive || agentContext.lead.statusFlow === "FINISHED") {
    return { canAnswer: false, reason: "lead_with_human", shouldSendTextOnlyNotice: true };
  }
  const recentCalls = await prisma.leadJourneyEvent.count({
    where: { leadId: lead.id, kind: "voice_call", occurredAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  if (recentCalls >= resolveMaxCallsPerHour()) {
    return { canAnswer: false, reason: "client_call_limit", shouldSendTextOnlyNotice: true };
  }

  const tools = buildAgentTools(agentContext);
  const knowledge = await loadAttendanceKnowledgeBlock({
    organizationId: instance.organizationId,
    knowledgeIds: agentContext.capabilities.knowledgeIds,
    maxChars: MAX_COMPANY_KNOWLEDGE_CHARS,
  });
  const assistantName = agentContext.settings.assistantName?.trim() || "Astro";
  const instructions = [
    buildSystemPrompt({
      settings: agentContext.settings,
      orgName: agentContext.organization.name,
      leadName: agentContext.lead.name === "Sem nome" ? null : agentContext.lead.name,
      currentTags: agentContext.lead.leadTags,
      availableTags: agentContext.availableTags,
      availableButtonPresets: [],
      availableAgendas: agentContext.availableAgendas,
      availableForms: agentContext.availableForms,
      capabilities: agentContext.capabilities,
    }),
    knowledge,
    VOICE_RULES,
  ]
    .filter(Boolean)
    .join("\n\n");

  const chosenVoice = findBotVoice(agentContext.capabilities.voiceName).name;
  const companyLinks = agentContext.capabilities.links.isEnabled ? agentContext.capabilities.links.items : [];
  const sendCompanionText = (text: string) =>
    sendCallCompanionText({
      trackingId: instance.trackingId,
      leadId: lead.id,
      leadPhone: lead.phone ?? params.callerPhone,
      conversationId,
      senderName: assistantName,
      text,
    });
  const sendCompanyLink = async (rawArguments: string): Promise<string> => {
    let requestedLabel = "";
    try {
      requestedLabel = String((JSON.parse(rawArguments || "{}") as { label?: unknown }).label ?? "");
    } catch {
      requestedLabel = "";
    }
    const link = companyLinks.find((item) => item.label.toLowerCase() === requestedLabel.trim().toLowerCase());
    if (!link) return JSON.stringify({ error: "Link não encontrado. Opções: " + companyLinks.map((item) => item.label).join(", ") });
    await sendCompanionText(`${link.label}: ${link.url}`);
    return JSON.stringify({ success: true, sent: link.label, note: "Enviado por mensagem. Não leia o endereço." });
  };
  const runTool = async (toolName: string, rawArguments: string): Promise<string> => {
    if (toolName === SEND_LINK_TOOL_NAME) return companyLinks.length > 0 ? sendCompanyLink(rawArguments) : "Ferramenta indisponível nesta ligação.";
    const definition = tools[toolName] as { execute?: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<unknown> } | undefined;
    if (!definition?.execute || TOOLS_NOT_FOR_VOICE.has(toolName)) return "Ferramenta indisponível nesta ligação.";
    let input: unknown = {};
    try {
      input = JSON.parse(rawArguments || "{}");
    } catch {
      return "Não entendi o pedido. Peça para repetir.";
    }
    const output = await definition.execute(input, { toolCallId: `call-${Date.now()}`, messages: [] });
    const serialized = JSON.stringify(toolName === SLOTS_TOOL_NAME ? toSpokenSlots(output) : (output ?? {}));
    // Link não se fala: vai por mensagem, e a voz só recebe o aviso de que foi enviado.
    const links = [...new Set(serialized.match(URL_IN_TOOL_OUTPUT) ?? [])];
    if (links.length > 0) {
      await sendCompanionText(`Segue o link:\n${links.join("\n")}`).catch((sendError: unknown) =>
        console.warn("[voice-call] link por mensagem falhou", sendError instanceof Error ? sendError.message.slice(0, 120) : "erro"),
      );
    }
    return serialized.replace(URL_IN_TOOL_OUTPUT, LINK_SENT_NOTE).slice(0, TOOL_OUTPUT_LIMIT);
  };

  return {
    canAnswer: true,
    persona: {
      organizationId: instance.organizationId,
      callerKey: `lead:${lead.id}`,
      callerName: agentContext.lead.name === "Sem nome" ? null : agentContext.lead.name,
      greeting: `Atenda a ligação agora dizendo exatamente: "Olá, aqui é ${assistantName}, assistente virtual da ${agentContext.organization.name}. Como posso ajudar?"`,
      runTool,
      sessionConfig: {
        type: "realtime",
        model: resolveVoiceModel(null),
        instructions,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: { model: "gpt-4o-transcribe", language: "pt" },
            turn_detection: null,
          },
          output: { voice: REALTIME_VOICES.has(chosenVoice) ? chosenVoice : DEFAULT_REALTIME_VOICE },
        },
        tools: [
          ...toRealtimeTools(tools),
          ...(companyLinks.length > 0
            ? [
                {
                  type: "function",
                  name: SEND_LINK_TOOL_NAME,
                  description: "Envia por mensagem de WhatsApp um link da empresa que a pessoa pediu. Depois de usar, diga apenas que mandou por mensagem.",
                  parameters: {
                    type: "object",
                    properties: { label: { type: "string", enum: companyLinks.map((item) => item.label) } },
                    required: ["label"],
                  },
                },
              ]
            : []),
        ],
        tool_choice: "auto",
      },
    },
  };
}
