import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { createChannelGateway, socialRepositoriesForOrganization } from "@/modules/social";
import { readInstagramMetadata, type InstagramMessageMetadata } from "../../lib/instagram-message-metadata";

/**
 * Envio do chat para lead do Instagram conectado pela Meta (spec 0062, RF-7).
 * Comentário citado → resposta naquele comentário; sem citação → DM (resposta privada
 * ao último comentário se o lead nunca mandou DM). Devolve null para cair no fluxo antigo.
 */
export async function sendInstagramFromChat(input: {
  organizationId: string;
  conversationId: string;
  leadPhone: string;
  text: string;
  quotedMessageInternalId?: string;
}): Promise<{ externalMessageId: string; metadata: InstagramMessageMetadata } | null> {
  const { channels } = socialRepositoriesForOrganization(input.organizationId);
  const channel = await channels.findWithCredentials();
  if (!channel || channel.credentials.authMode !== "META_LOGIN" || channel.status !== "ACTIVE") return null;
  const gateway = createChannelGateway(channel);
  const failWith = (error: string): never => {
    throw new ORPCError("BAD_REQUEST", { message: `O Instagram recusou: ${error}` });
  };

  const quoted = input.quotedMessageInternalId
    ? await prisma.message.findFirst({
        where: { id: input.quotedMessageInternalId, conversationId: input.conversationId },
        select: { messageId: true, metadata: true },
      })
    : null;
  const quotedInstagram = quoted ? readInstagramMetadata(quoted.metadata) : null;

  if (quoted && quotedInstagram?.kind === "COMMENT") {
    const result = await gateway.replyToComment({ commentId: quoted.messageId, text: input.text });
    if (!result.ok) failWith(result.error);
    return {
      externalMessageId: (result.ok && result.externalMessageId) || `ig-reply-${Date.now()}`,
      metadata: { kind: "COMMENT_REPLY", commentId: quoted.messageId, media: quotedInstagram.media ?? null },
    };
  }

  const hasDirectThread = await prisma.message.findFirst({
    where: { conversationId: input.conversationId, fromMe: false, metadata: { path: ["instagram", "kind"], equals: "DIRECT_MESSAGE" } },
    select: { id: true },
  });
  const latestComment = hasDirectThread
    ? null
    : await prisma.message.findFirst({
        where: { conversationId: input.conversationId, fromMe: false, metadata: { path: ["instagram", "kind"], equals: "COMMENT" } },
        orderBy: { createdAt: "desc" },
        select: { messageId: true },
      });

  const result = await gateway.sendDirectMessage(
    latestComment ? { commentId: latestComment.messageId, text: input.text } : { externalUserId: input.leadPhone, text: input.text },
  );
  if (!result.ok) failWith(result.error);
  return {
    externalMessageId: (result.ok && result.externalMessageId) || `ig-dm-${Date.now()}`,
    metadata: { kind: "DIRECT_MESSAGE" },
  };
}
