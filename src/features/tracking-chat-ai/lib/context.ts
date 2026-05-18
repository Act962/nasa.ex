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
  const [lead, conversation, settings, instance, organization, messages] =
    await Promise.all([
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
          leadTags: { include: { tag: { select: { name: true } } } },
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
    ]);

  const history: ModelMessage[] = messages
    .reverse()
    .map((m) => toModelMessage(m))
    .filter((m): m is ModelMessage => m !== null);

  return {
    trackingId: data.trackingId,
    organizationId: data.organizationId,
    lead,
    conversation,
    settings,
    instance,
    organization,
    history,
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
