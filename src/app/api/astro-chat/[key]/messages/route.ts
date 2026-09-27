import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { MessageStatus } from "@/generated/prisma/enums";
import { firePostInboundAutomations } from "@/features/tracking-chat/lib/incoming-message-pipeline";
import { truncateLeadMessageText } from "@/features/tracking-executions/lib/lead-message";
import {
  MESSAGES_PAGE_SIZE,
  MESSAGE_MAX_CHARS,
} from "@/features/astro-chat/lib/constants";
import {
  toPublicMessage,
  publicMessageSelect,
} from "@/features/astro-chat/lib/public-message";
import { isVisitorMessageAllowed } from "@/features/astro-chat/server/rate-limit";
import { ensureVisitorConversation } from "@/features/astro-chat/server/visitor-lead";
import {
  handlePreflight,
  isGateFailure,
  jsonResponse,
  readIpHash,
  readRequestOrigin,
  resolvePublicSite,
  resolveVisitor,
} from "@/features/astro-chat/server/public-api";

/**
 * Mensagens do visitante do ASTRO CHAT (spec 0031).
 * GET  ?after=<id> — novas mensagens (consulta periódica, D-7).
 * POST { body }    — grava, avisa o Chat e enfileira a resposta do ASTRO.
 */

type RouteParams = { params: Promise<{ key: string }> };

const sendInputSchema = z.object({
  body: z.string().trim().min(1).max(MESSAGE_MAX_CHARS),
});

export async function OPTIONS(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  return handlePreflight(request, key);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  const origin = readRequestOrigin(request);
  const gate = await resolvePublicSite(key, origin);
  if (isGateFailure(gate)) {
    return jsonResponse(
      { error: gate.error },
      { status: gate.status, origin: null },
    );
  }
  const visitor = await resolveVisitor(request, gate.site.id);
  if (!visitor)
    return jsonResponse({ error: "unauthorized" }, { status: 401, origin });
  if (!visitor.leadId) return jsonResponse({ items: [] }, { origin });

  const conversation = await prisma.conversation.findUnique({
    where: { leadId: visitor.leadId },
    select: { id: true },
  });
  if (!conversation) return jsonResponse({ items: [] }, { origin });

  const afterId = request.nextUrl.searchParams.get("after");
  const afterMessage = afterId
    ? await prisma.message.findFirst({
        where: { id: afterId, conversationId: conversation.id },
        select: { createdAt: true },
      })
    : null;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      ...(afterMessage ? { createdAt: { gt: afterMessage.createdAt } } : {}),
    },
    orderBy: [{ createdAt: afterMessage ? "asc" : "desc" }, { id: "asc" }],
    take: MESSAGES_PAGE_SIZE,
    select: publicMessageSelect,
  });
  const ordered = afterMessage ? messages : messages.reverse();
  return jsonResponse({ items: ordered.map(toPublicMessage) }, { origin });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  const origin = readRequestOrigin(request);
  const gate = await resolvePublicSite(key, origin);
  if (isGateFailure(gate)) {
    return jsonResponse(
      { error: gate.error },
      { status: gate.status, origin: null },
    );
  }
  const { site } = gate;
  const visitor = await resolveVisitor(request, site.id);
  if (!visitor)
    return jsonResponse({ error: "unauthorized" }, { status: 401, origin });

  const payload = sendInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!payload.success)
    return jsonResponse({ error: "invalid_input" }, { status: 400, origin });

  const existingConversation = visitor.leadId
    ? await prisma.conversation.findUnique({
        where: { leadId: visitor.leadId },
        select: { id: true },
      })
    : null;
  const isAllowed = await isVisitorMessageAllowed({
    visitorId: visitor.id,
    conversationId: existingConversation?.id ?? null,
    ipHash: visitor.ipHash ?? readIpHash(request),
  });
  if (!isAllowed)
    return jsonResponse({ error: "rate_limited" }, { status: 429, origin });

  const conversation = await ensureVisitorConversation({
    site,
    visitor,
    appOrigin: request.nextUrl.origin,
  });
  if (!conversation)
    return jsonResponse({ error: "not_configured" }, { status: 403, origin });

  const externalMessageId = `astrochat-${uuidv4()}`;
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.conversationId,
      messageId: externalMessageId,
      body: payload.data.body,
      fromMe: false,
      status: MessageStatus.SEEN,
      viaInChat: true,
      metadata: { astroChat: { siteId: site.id } },
    },
    select: {
      ...publicMessageSelect,
      conversationId: true,
      conversation: {
        select: {
          lead: {
            select: {
              id: true,
              name: true,
              isActive: true,
              firstResponseAt: true,
              lastInboundAt: true,
            },
          },
        },
      },
    },
  });
  const lead = message.conversation.lead;

  await prisma.astroChatVisitor.update({
    where: { id: visitor.id },
    data: { lastSeenAt: new Date() },
  });

  // Automações e IA depois da resposta: o visitante não espera alertas, workflows e fila.
  after(async () => {
    await conversation.runNewLeadSideEffects?.();
    // globalAiActive=false: quem responde aqui é o ASTRO público, não o agente do WhatsApp.
    await firePostInboundAutomations({
      trackingId: conversation.trackingId,
      organizationId: site.organizationId,
      globalAiActive: false,
      lead: {
        id: lead.id,
        isActive: lead.isActive,
        firstResponseAt: lead.firstResponseAt,
        lastInboundAt: lead.lastInboundAt,
        conversation: { id: conversation.conversationId },
      },
      messageId: message.id,
      externalMessageId,
      fromMe: false,
      channel: "ASTRO_CHAT",
      leadMessage: {
        text: truncateLeadMessageText(payload.data.body),
        messageId: externalMessageId,
        sentAt: message.createdAt.toISOString(),
        source: "TRIGGER_EVENT",
      },
      messagePayload: {
        ...message,
        viaInChat: true,
        conversation: {
          id: conversation.conversationId,
          lead: { id: lead.id, name: lead.name },
        },
      },
    });

    try {
      await inngest.send({
        name: "astro-chat/message-received",
        data: {
          siteId: site.id,
          organizationId: site.organizationId,
          trackingId: conversation.trackingId,
          leadId: lead.id,
          conversationId: conversation.conversationId,
          visitorId: visitor.id,
        },
      });
    } catch (error) {
      console.error("[astro-chat] inngest_send_failed", error);
    }
  });

  return jsonResponse({ message: toPublicMessage(message) }, { origin });
}
