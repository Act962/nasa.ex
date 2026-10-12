import "server-only";
import { generateText, type ModelMessage, type ToolSet } from "ai";
import prisma from "@/lib/prisma";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { recordUsageEvent } from "@/features/stars/lib/metering";
import { loadAttendanceKnowledgeBlock } from "./attendance-knowledge";
import { parseAiCapabilities } from "./capabilities";
import { toModelConfig } from "./context";
import { runGuidedMenuTest, type GuidedMenuChannel, type GuidedMenuContext } from "./guided-menu/guided-menu";
import { resolveModel } from "./model";
import { splitForWhatsapp } from "./split-message";
import { buildSystemPrompt } from "./system-prompt";
import { buildLeadAgendaScope } from "../server/tools";
import { makeLeadAgendaTools } from "../server/tools/agenda";
import { makeLeadServiceTools } from "../server/tools/client-services";

/**
 * Teste do atendimento pela tela de configuração (spec 0089). Mostra o que o cliente veria no
 * WhatsApp sem mandar nada a ninguém: o menu roda em modo de teste, e a assistente responde com
 * as instruções, os documentos e as opções ligadas no funil, mas só com ferramentas de leitura.
 * Tudo o que gravaria ou enviaria algo é simulado.
 */

const TEST_LEAD_ID = "attendance-test";
const MAX_HISTORY_TURNS = 20;
const MAX_TURN_CHARS = 1500;
/** Só consultam: rodam de verdade no teste. As demais são simuladas. */
const READ_ONLY_TOOLS = new Set(["list_agendas", "get_available_slots"]);
const SIMULATED_TOOL_OUTPUT = {
  success: true,
  testMode: true,
  note: "Modo de teste: a ação foi simulada, nada foi gravado nem enviado. Responda ao cliente como se tivesse dado certo, sem mencionar que é teste.",
};
const TEST_PROMPT_NOTE = [
  "## Teste pela equipe",
  "Esta conversa é um teste feito pela equipe da empresa na tela de configuração. Responda exatamente como responderia a um cliente pelo WhatsApp.",
  "O cliente do teste não tem nome nem agendamentos anteriores.",
].join("\n");

export interface AttendanceTestOption {
  id: string;
  title: string;
  description?: string;
}

export interface AttendanceTestMessage {
  body: string;
  options: AttendanceTestOption[];
  /** `menu`: passo em código, sem IA. `assistant`: resposta da assistente. `notice`: aviso do próprio teste. */
  kind: "menu" | "assistant" | "notice";
}

export interface AttendanceTestTurn {
  role: "client" | "assistant";
  text: string;
}

function toSimulatedTools(tools: ToolSet): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([toolName, definition]) => {
      if (READ_ONLY_TOOLS.has(toolName)) return [toolName, definition];
      const output = toolName === "list_my_appointments" ? { appointments: [] } : SIMULATED_TOOL_OUTPUT;
      return [toolName, { ...definition, execute: async () => output }];
    }),
  ) as ToolSet;
}

export async function runAttendanceTest(params: {
  organizationId: string;
  trackingId: string;
  userId: string;
  text: string;
  clickId: string | null;
  history: AttendanceTestTurn[];
}): Promise<{ messages: AttendanceTestMessage[] }> {
  const tracking = await prisma.tracking.findFirst({
    where: { id: params.trackingId, organizationId: params.organizationId },
    select: { id: true, organization: { select: { name: true } }, aiSettings: true },
  });
  if (!tracking) return { messages: [{ body: "Tracking não encontrado.", options: [], kind: "notice" }] };
  const settings = tracking.aiSettings;
  if (!settings?.prompt?.trim()) {
    return { messages: [{ body: "Preencha as instruções e salve antes de testar.", options: [], kind: "notice" }] };
  }
  const capabilities = parseAiCapabilities(settings.capabilities);

  const menuContext: GuidedMenuContext = {
    organizationId: params.organizationId,
    trackingId: tracking.id,
    capabilities,
    lead: { id: TEST_LEAD_ID, name: "Cliente de teste", phone: null },
    conversation: { id: TEST_LEAD_ID },
    settings: { assistantName: settings.assistantName },
    organization: { name: tracking.organization.name },
  };

  const messages: AttendanceTestMessage[] = [];
  const collectingChannel: GuidedMenuChannel = {
    sendButtons: async (_phone, payload) => {
      messages.push({
        body: payload.bodyText,
        options: payload.buttons.map((button) => ({ id: button.id, title: button.text, description: button.description })),
        kind: "menu",
      });
      return { messageId: null };
    },
    sendText: async (_phone, text) => {
      messages.push({ body: text, options: [], kind: "menu" });
      return { messageId: null };
    },
  };
  const guided = await runGuidedMenuTest(menuContext, { text: params.text, replyId: params.clickId }, collectingChannel);
  if (guided.handled) return { messages };

  // Texto livre: quem responde é a assistente, e custa como uma resposta normal.
  const charge = await chargeStarsByAction(params.organizationId, "chat_ai_message", {
    userId: params.userId,
    description: "Teste do atendimento (resposta da assistente)",
    appSlug: "chat_ai_message",
  });
  if (!charge.success) {
    return { messages: [{ body: "Sem saldo de Stars para testar a resposta da assistente. Os botões continuam funcionando.", options: [], kind: "notice" }] };
  }

  const [availableTags, availableAgendas, availableForms, knowledgeBlock] = await Promise.all([
    prisma.tag.findMany({
      where: {
        organizationId: params.organizationId,
        OR: [{ trackingId: tracking.id }, { trackingId: null }],
        description: { not: null },
        archivedAt: null,
        type: { not: "SYSTEM" },
      },
      select: { id: true, name: true, description: true },
    }),
    capabilities.agenda.isEnabled && capabilities.agenda.agendaIds.length > 0
      ? prisma.agenda.findMany({
          where: { id: { in: capabilities.agenda.agendaIds }, organizationId: params.organizationId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
    capabilities.forms.isEnabled && capabilities.forms.formIds.length > 0
      ? prisma.form.findMany({
          where: { id: { in: capabilities.forms.formIds }, organizationId: params.organizationId, published: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
    loadAttendanceKnowledgeBlock({ organizationId: params.organizationId, knowledgeIds: capabilities.knowledgeIds }),
  ]);

  const system = [
    buildSystemPrompt({
      settings,
      orgName: tracking.organization.name,
      leadName: null,
      currentTags: [],
      availableTags: availableTags.filter((tag) => tag.description?.trim()),
      availableButtonPresets: [],
      availableAgendas,
      availableForms,
      capabilities,
    }),
    knowledgeBlock,
    TEST_PROMPT_NOTE,
  ]
    .filter(Boolean)
    .join("\n\n");

  const agendaScope = buildLeadAgendaScope(menuContext);
  const tools = toSimulatedTools({
    ...(agendaScope ? makeLeadAgendaTools(agendaScope) : {}),
    ...makeLeadServiceTools({
      organizationId: params.organizationId,
      trackingId: tracking.id,
      leadId: TEST_LEAD_ID,
      leadName: null,
      assistantName: settings.assistantName ?? "Astro",
      capabilities,
    }),
  });

  const conversation: ModelMessage[] = [
    ...params.history.slice(-MAX_HISTORY_TURNS).map(
      (turn): ModelMessage => ({
        role: turn.role === "client" ? "user" : "assistant",
        content: turn.text.slice(0, MAX_TURN_CHARS),
      }),
    ),
    { role: "user", content: params.text.slice(0, MAX_TURN_CHARS) },
  ];

  const resolved = resolveModel(toModelConfig(settings));
  const result = await generateText({
    model: resolved.model,
    system,
    tools,
    messages: conversation,
    stopWhen: ({ steps }) => steps.length >= 6,
  });
  await recordUsageEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    kind: "LLM",
    action: "chat_ai_message",
    appSlug: "chat_ai_message",
    feature: "tracking-chat-ai.attendance-test",
    provider: String(resolved.provider).toLowerCase(),
    modelId: resolved.modelId,
    usingCustomKey: resolved.usingCustom,
    tokens: {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
    },
  }).catch(() => undefined);

  const replyText = result.text.trim() || "A assistente não respondeu a essa mensagem.";
  for (const part of splitForWhatsapp(replyText)) messages.push({ body: part, options: [], kind: "assistant" });
  return { messages };
}
