/**
 * In-Chat — endpoints públicos de mensagens.
 *
 * GET  /api/in-chat/[slug]/messages?cursor=<id>
 *   Lista mensagens da conversa do lead identificado (via cookie).
 *
 * POST /api/in-chat/[slug]/messages
 *   Body: { body: string }
 *   Cria uma mensagem `fromMe: false` (do lead) + `viaInChat: true`.
 *   Notifica o atendente via Pusher pra UI atualizar em tempo real.
 *
 * Autenticação: cookie `nasa_inchat_lead = <orgId>:<leadId>` setado pelo
 * endpoint `/identify`. Sem o cookie → 401.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { MessageStatus } from "@/generated/prisma/enums";
import { v4 as uuidv4 } from "uuid";

const COOKIE_NAME = "nasa_inchat_lead";

/**
 * Lê + valida o cookie. Retorna `{ orgId, leadId }` ou null se inválido.
 * Confere também se o slug do path bate com o orgId do cookie (evita
 * usar cookie de uma org pra falar com chat de outra).
 */
async function resolveLeadFromCookie(
  req: NextRequest,
  slug: string,
): Promise<{ orgId: string; leadId: string; conversationId: string } | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const [orgId, leadId] = cookie.split(":");
  if (!orgId || !leadId) return null;

  const org = await prisma.organization.findFirst({
    where: { id: orgId, slug },
    select: { id: true },
  });
  if (!org) return null;

  // Confirma que o lead pertence à org + pega a conversation principal
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      tracking: { organizationId: org.id },
    },
    select: { conversation: { select: { id: true } } },
  });
  if (!lead?.conversation) return null;

  return { orgId, leadId, conversationId: lead.conversation.id };
}

const LIMIT = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await resolveLeadFromCookie(req, slug);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
  const messages = await prisma.message.findMany({
    where: {
      conversationId: auth.conversationId,
      // Em mensagens deletadas (status DELETED), só mostra placeholder
      // (a UI já trata isso).
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: LIMIT,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      messageId: true,
      body: true,
      mediaUrl: true,
      mediaType: true,
      mimetype: true,
      fileName: true,
      createdAt: true,
      fromMe: true,
      status: true,
      senderName: true,
      viaInChat: true,
    },
  });

  return NextResponse.json({
    items: messages,
    // `conversationId` exposto pro client subscribar no canal Pusher
    // correspondente. É um cuid de 25 chars (~6×10^36 espaço) —
    // unguessable o suficiente pra dispensar canal privado no MVP.
    conversationId: auth.conversationId,
    nextCursor:
      messages.length === LIMIT ? messages[messages.length - 1].id : null,
  });
}

const sendSchema = z.object({
  /** Texto da mensagem. Pode ser vazio quando há mídia anexada. */
  body: z.string().max(4000).optional(),
  /** URL/key R2 do arquivo de mídia (upload prévio via /api/s3/upload). */
  mediaUrl: z.string().optional(),
  /** Mimetype real do arquivo (`image/jpeg`, `audio/webm`, etc). */
  mimetype: z.string().optional(),
  /** Nome do arquivo (pra documentos, áudio etc). */
  fileName: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await resolveLeadFromCookie(req, slug);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Sem texto E sem mídia → request inválido (nada pra enviar)
  if (!parsed.data.body?.trim() && !parsed.data.mediaUrl) {
    return NextResponse.json(
      { error: "body_or_media_required" },
      { status: 400 },
    );
  }

  // Deriva `mediaType` pela mimetype — segue o mesmo padrão do
  // tracking-chat (image/audio/video/document).
  let mediaType: string | null = null;
  if (parsed.data.mimetype) {
    if (parsed.data.mimetype.startsWith("image/")) mediaType = "image";
    else if (parsed.data.mimetype.startsWith("audio/")) mediaType = "audio";
    else if (parsed.data.mimetype.startsWith("video/")) mediaType = "video";
    else mediaType = "document";
  }

  const message = await prisma.message.create({
    data: {
      conversationId: auth.conversationId,
      messageId: `inchat-${uuidv4()}`,
      body: parsed.data.body?.trim() || null,
      mediaUrl: parsed.data.mediaUrl ?? null,
      mediaType,
      mimetype: parsed.data.mimetype ?? null,
      fileName: parsed.data.fileName ?? null,
      fromMe: false, // veio do lead
      status: MessageStatus.SEEN,
      senderId: null,
      senderName: null,
      viaInChat: true,
    },
    select: {
      id: true,
      messageId: true,
      body: true,
      createdAt: true,
      fromMe: true,
      status: true,
      senderName: true,
      viaInChat: true,
      conversationId: true,
      conversation: {
        select: { id: true, lead: { select: { id: true, name: true } } },
      },
    },
  });

  // Atualiza lastMessage da conversation pra a sidebar refletir
  await prisma.conversation.update({
    where: { id: auth.conversationId },
    data: {
      lastMessage: { connect: { id: message.id } },
      lastMessageAt: message.createdAt,
    },
  });

  // Pusher → notifica atendentes
  await pusherServer.trigger(auth.conversationId, "message:new", {
    ...message,
    conversation: {
      id: message.conversationId,
      lead: message.conversation.lead,
    },
  });

  return NextResponse.json({ message });
}
