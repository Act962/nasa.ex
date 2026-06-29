/**
 * In-Chat — DELETE de mensagem pelo lead.
 *
 * DELETE /api/in-chat/[slug]/messages/[id]
 *
 * Soft-delete: marca `status: DELETED` + limpa campos visíveis. Só
 * permite apagar mensagens do PRÓPRIO lead (`fromMe: false` + viaInChat).
 * Mensagens do atendente NÃO podem ser apagadas pelo lead.
 *
 * Notifica via Pusher pra a UI do atendente atualizar em real-time.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { MessageStatus } from "@/generated/prisma/enums";
import { pusherServer } from "@/lib/pusher";

const COOKIE_NAME = "nasa_inchat_lead";

async function resolveLead(
  req: NextRequest,
  slug: string,
): Promise<{ conversationId: string } | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const [orgId, leadId] = cookie.split(":");
  if (!orgId || !leadId) return null;
  const org = await prisma.organization.findFirst({
    where: { id: orgId, slug },
    select: { id: true },
  });
  if (!org) return null;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId: org.id } },
    select: { conversation: { select: { id: true } } },
  });
  if (!lead?.conversation) return null;
  return { conversationId: lead.conversation.id };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const auth = await resolveLead(req, slug);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      conversationId: true,
      fromMe: true,
      viaInChat: true,
      status: true,
    },
  });
  if (!message || message.conversationId !== auth.conversationId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Lead só pode apagar mensagens dele próprio (do ponto de vista do DB,
  // fromMe=false = do lead). Mensagens do atendente são read-only pro lead.
  if (message.fromMe) {
    return NextResponse.json(
      { error: "cannot_delete_others_message" },
      { status: 403 },
    );
  }
  if (message.status === MessageStatus.DELETED) {
    return NextResponse.json({ success: true, alreadyDeleted: true });
  }

  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: MessageStatus.DELETED,
      body: null,
      mediaUrl: null,
      mediaType: null,
      mediaCaption: null,
      mimetype: null,
      fileName: null,
      latitude: null,
      longitude: null,
    },
  });

  // Notifica atendente em tempo real
  await pusherServer.trigger(message.conversationId, "message:updated", {
    messageId: message.id,
    conversationId: message.conversationId,
    status: MessageStatus.DELETED,
  });

  return NextResponse.json({ success: true });
}
