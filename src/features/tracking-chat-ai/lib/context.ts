import prisma from "@/lib/prisma";
import type { ModelMessage } from "ai";

const HISTORY_LIMIT = 20;

export interface AgentEventData {
  trackingId: string;
  leadId: string;
  conversationId: string;
  messageId: string;
  organizationId: string;
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
        mediaCaption: true,
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
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Mudança no prompt zera o histórico visível pra IA. Sem isso, o modelo
  // tende a manter tom/estilo das respostas anteriores (viés de continuidade)
  // mesmo com instrução nova no system. Slate limpo é o caminho mais
  // confiável até a v2 híbrida (ver PROGRESS.md "Backlog").
  const promptUpdatedAt = settings?.updatedAt ?? null;
  const history: ModelMessage[] = messages
    .filter((m) => !promptUpdatedAt || m.createdAt > promptUpdatedAt)
    .reverse()
    .map((m) => toModelMessage(m))
    .filter((m): m is ModelMessage => m !== null);

  const availableTagsFiltered = availableTags.filter(
    (t) => t.description !== null && t.description.trim().length > 0,
  );

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
  };
}

function toModelMessage(m: {
  fromMe: boolean;
  body: string | null;
  mediaType: string | null;
  mediaCaption: string | null;
}): ModelMessage | null {
  const text =
    m.body?.trim() ||
    m.mediaCaption?.trim() ||
    (m.mediaType ? `[${m.mediaType}]` : "");
  if (!text) return null;
  return {
    role: m.fromMe ? "assistant" : "user",
    content: text,
  };
}

export type AgentContext = Awaited<ReturnType<typeof loadAgentContext>>;
