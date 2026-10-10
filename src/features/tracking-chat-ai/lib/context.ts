import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import type { ModelMessage } from "ai";
import type { AiModelConfig } from "./model";
import { loadActiveCatalogOrder } from "@/features/nerp-catalog/lib/order-context";
import { getActiveProgram } from "@/features/star-friends/lib/program";
import { parseAiCapabilities } from "./capabilities";
import { isAudioTooLong, readAudioTranscription } from "./audio-metadata";

const HISTORY_LIMIT = 20;

export type AgentTrigger =
  | "inbound"
  | "idle-reopen"
  | "idle-reopen-with-instruction";

export interface AgentEventData {
  trackingId: string;
  leadId: string;
  conversationId: string;
  messageId: string;
  organizationId: string;
  // Origem do disparo. Default "inbound" (mensagem do lead chegou).
  // "idle-reopen-with-instruction" injeta system note pra IA reabrir a conversa.
  trigger?: AgentTrigger;
  idleMinutes?: number;
}

export async function loadAgentContext(data: AgentEventData) {
  const [
    lead,
    conversation,
    settings,
    instance,
    organization,
    messages,
    availableTags,
    availableButtonPresets,
    catalogOrder,
    starFriendsProgram,
  ] = await Promise.all([
    prisma.lead.findUniqueOrThrow({
      where: { id: data.leadId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        description: true,
        statusFlow: true,
        isActive: true,
        source: true,
        temperature: true,
        trackingId: true,
        leadTags: {
          include: { tag: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.conversation.findUniqueOrThrow({
      where: { id: data.conversationId },
      select: { id: true, remoteJid: true, trackingId: true, isActive: true },
    }),
    prisma.aiSettings.findUnique({
      where: { trackingId: data.trackingId },
    }),
    prisma.whatsAppInstance.findUnique({
      where: { trackingId: data.trackingId },
      select: { apiKey: true, baseUrl: true, status: true },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: data.organizationId },
      select: { id: true, name: true },
    }),
    prisma.message.findMany({
      where: { conversationId: data.conversationId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        fromMe: true,
        body: true,
        mediaType: true,
        mimetype: true,
        mediaCaption: true,
        metadata: true,
        createdAt: true,
      },
    }),
    // ↑ histórico é filtrado depois pelo `settings.updatedAt` (ver abaixo).
    // Catálogo de tags que a IA pode aplicar — só tags com descrição
    // preenchida entram. Description vazia = invisível pra IA. Funciona
    // como switch manual: o time controla o que a IA pode taggear.
    prisma.tag.findMany({
      where: {
        organizationId: data.organizationId,
        OR: [{ trackingId: data.trackingId }, { trackingId: null }],
        description: { not: null },
        archivedAt: null,
        // Tags padrão ("Aguard. atendimento", "WhatsApp"…) são aplicadas pelo código, nunca pela assistente.
        type: { not: "SYSTEM" },
      },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
    // Presets de botões ativos. Mesmo critério das tags: só os ativos
    // entram no catálogo da IA. Toggle isActive=false na UI pausa o
    // preset sem deletar (alinha com o memorial "desativar vs deletar").
    prisma.aiButtonPreset.findMany({
      where: { trackingId: data.trackingId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        bodyText: true,
        footerText: true,
        buttons: true,
        menuFormat: true,
        listButton: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    loadActiveCatalogOrder(data.leadId),
    getActiveProgram(data.organizationId),
  ]);

  const capabilities = parseAiCapabilities(settings?.capabilities);
  // Agendas liberadas ao agente (spec 0084): nome e id entram no prompt, para ele não precisar perguntar.
  const availableAgendas =
    capabilities.agenda.isEnabled && capabilities.agenda.agendaIds.length > 0
      ? await prisma.agenda.findMany({
          where: { id: { in: capabilities.agenda.agendaIds }, organizationId: data.organizationId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const availableForms =
    capabilities.forms.isEnabled && capabilities.forms.formIds.length > 0
      ? await prisma.form.findMany({
          where: { id: { in: capabilities.forms.formIds }, organizationId: data.organizationId, published: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  // Mudança no prompt zera o histórico visível pra IA. Sem isso, o modelo
  // tende a manter tom/estilo das respostas anteriores (viés de continuidade)
  // mesmo com instrução nova no system. Slate limpo é o caminho mais
  // confiável até a v2 híbrida (ver PROGRESS.md "Backlog").
  const promptUpdatedAt = settings?.updatedAt ?? null;
  const filtered = promptUpdatedAt
    ? messages.filter((m) => m.createdAt > promptUpdatedAt)
    : messages;

  // Slate-reset é best-effort. Se o filtro zerou TUDO (race entre a
  // persistência da inbound no webhook e o `@updatedAt` do AiSettings,
  // ou idle-reopen logo após editar o prompt) cai pro histórico cheio.
  // Histórico vazio quebra o SDK com `messages must not be empty`.
  const source = filtered.length > 0 ? filtered : messages;
  const history: ModelMessage[] = source
    .slice()
    .reverse()
    .map((m) => toModelMessage(m))
    .filter((m): m is ModelMessage => m !== null);

  const availableTagsFiltered = availableTags.filter(
    (t) => t.description !== null && t.description.trim().length > 0,
  );

  // Trigger de ociosidade — injeta system note pra IA entender que está
  // reabrindo a conversa sem que o lead tenha mandado nova mensagem.
  // O agente NÃO recebe esse trigger como user message; entra como instrução
  // de comportamento via system prompt extra (gerado em agent.ts).
  const trigger: AgentTrigger = data.trigger ?? "inbound";

  // BYO model: decifra a key uma vez aqui. Se cifragem falhar (chave rotacionada,
  // dado corrompido), loga e cai pro default — nunca derruba o agente.
  const modelConfig: AiModelConfig | null = settings?.aiProvider
    ? {
        provider: settings.aiProvider,
        modelId: settings.aiModelId,
        apiKey: settings.aiApiKey ? safeDecrypt(settings.aiApiKey) : null,
      }
    : null;

  return {
    trackingId: data.trackingId,
    organizationId: data.organizationId,
    lead,
    conversation,
    settings,
    instance,
    organization,
    history,
    availableTags: availableTagsFiltered,
    availableButtonPresets,
    trigger,
    idleMinutes: data.idleMinutes,
    modelConfig,
    catalogOrder,
    starFriendsProgramName: starFriendsProgram?.name ?? null,
    capabilities,
    availableAgendas,
    availableForms,
    // A última mensagem do cliente foi áudio: decide a resposta em voz (spec 0084, RF-3).
    isLastInboundAudio: isAudioMessage(messages.find((message) => !message.fromMe)),
  };
}

function isAudioMessage(message: { mediaType: string | null; mimetype?: string | null } | undefined): boolean {
  if (!message) return false;
  return message.mediaType === "audio" || Boolean(message.mimetype?.startsWith("audio/"));
}

function safeDecrypt(cipher: string): string | null {
  try {
    return decryptSecret(cipher);
  } catch (err) {
    console.error("[tracking-chat-ai] falha ao decifrar aiApiKey", err);
    return null;
  }
}

function toModelMessage(m: {
  fromMe: boolean;
  body: string | null;
  mediaType: string | null;
  mediaCaption: string | null;
  mimetype?: string | null;
  metadata?: unknown;
}): ModelMessage | null {
  // Áudio transcrito entra como o que o cliente disse (spec 0084, RF-1), marcado como áudio.
  const transcription = readAudioTranscription(m.metadata);
  const text =
    m.body?.trim() ||
    m.mediaCaption?.trim() ||
    (transcription ? `[áudio do cliente] ${transcription}` : "") ||
    (isAudioTooLong(m.metadata)
      ? "[áudio do cliente com mais de 3 minutos: não foi ouvido. Peça para resumir por texto ou ofereça um atendente.]"
      : "") ||
    (m.mediaType ? `[${m.mediaType}]` : "") ||
    (m.mimetype?.startsWith("audio/")
      ? "[áudio do cliente que não foi possível ouvir. Peça para escrever a mensagem.]"
      : "");
  if (!text) return null;
  return {
    role: m.fromMe ? "assistant" : "user",
    content: text,
  };
}

export type AgentContext = Awaited<ReturnType<typeof loadAgentContext>>;
