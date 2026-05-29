/**
 * In-Chat — listagem pública de mensagens com paginação por cursor.
 *
 * Procedure pública (sem `requiredAuthMiddleware`). A autenticação do lead
 * é feita via cookie `nasa_inchat_lead = <orgId>:<leadId>` setado pelo
 * endpoint REST `/api/in-chat/[slug]/identify`. O cookie é lido do header
 * `cookie` recebido no contexto.
 *
 * Espelha o contrato do route handler legado (`/api/in-chat/[slug]/messages`)
 * pra poder substituí-lo no client por `useInfiniteQuery` via oRPC, igual
 * o `tracking-chat` faz com `message.list`.
 */

import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const COOKIE_NAME = "nasa_inchat_lead";

function readCookie(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

const messageSelect = {
  id: true,
  messageId: true,
  body: true,
  mediaUrl: true,
  mediaType: true,
  mimetype: true,
  fileName: true,
  latitude: true,
  longitude: true,
  quotedMessageId: true,
  createdAt: true,
  fromMe: true,
  status: true,
  senderName: true,
  viaInChat: true,
  quotedMessage: {
    select: {
      id: true,
      body: true,
      mediaType: true,
      mimetype: true,
      fromMe: true,
      senderName: true,
    },
  },
} as const;

export const listInChatMessages = base
  .route({
    method: "GET",
    path: "/in-chat/list-messages",
    summary: "List in-chat messages for the identified lead",
  })
  .input(
    z.object({
      slug: z.string(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(30),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const cookie = readCookie(context.headers, COOKIE_NAME);
    if (!cookie) throw errors.UNAUTHORIZED;
    const [orgId, leadId] = cookie.split(":");
    if (!orgId || !leadId) throw errors.UNAUTHORIZED;

    const org = await prisma.organization.findFirst({
      where: { id: orgId, slug: input.slug },
      select: { id: true },
    });
    if (!org) throw errors.UNAUTHORIZED;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tracking: { organizationId: org.id } },
      select: { conversation: { select: { id: true } } },
    });
    if (!lead?.conversation) throw errors.UNAUTHORIZED;

    const conversationId = lead.conversation.id;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
      ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      select: messageSelect,
    });

    return {
      items: messages,
      conversationId,
      nextCursor:
        messages.length === input.limit
          ? messages[messages.length - 1].id
          : null,
    };
  });
