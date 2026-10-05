import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { createChannelGateway, socialRepositoriesForOrganization } from "@/modules/social";
import { readInstagramMetadata, type InstagramMessageMetadata } from "../../lib/instagram-message-metadata";

const RECENT_INBOUND_LOOKBACK = 20;

/**
 * Conversa anterior à spec 0069 não registra qual conta a recebeu: sai pela mais antiga
 * da organização, que era a única que existia (CB-13).
 */
async function findLegacyDefaultChannelId(organizationId: string): Promise<string | null> {
  const { channels } = socialRepositoriesForOrganization(organizationId);
  const [oldestChannel] = await channels.listForTenant("INSTAGRAM");
  return oldestChannel?.id ?? null;
}

type ReplyChannelRef = { channelId: string; isFromConversation: boolean };

/** A resposta sai pela conta da mensagem citada ou, sem citação, pela última que o lead usou (spec 0069, RF-18). */
async function resolveReplyChannel(input: {
  organizationId: string;
  conversationId: string;
  quotedMetadata: InstagramMessageMetadata | null;
}): Promise<ReplyChannelRef | null> {
  if (input.quotedMetadata?.channelId) return { channelId: input.quotedMetadata.channelId, isFromConversation: true };

  const recentInboundMessages = await prisma.message.findMany({
    where: { conversationId: input.conversationId, fromMe: false },
    orderBy: { createdAt: "desc" },
    take: RECENT_INBOUND_LOOKBACK,
    select: { metadata: true },
  });
  const latestChannelId = recentInboundMessages
    .map((message) => readInstagramMetadata(message.metadata)?.channelId)
    .find(Boolean);
  if (latestChannelId) return { channelId: latestChannelId, isFromConversation: true };
  const legacyChannelId = await findLegacyDefaultChannelId(input.organizationId);
  return legacyChannelId ? { channelId: legacyChannelId, isFromConversation: false } : null;
}

/**
 * Envio do chat para lead do Instagram conectado pela Meta (spec 0062, RF-7).
 * Comentário citado → resposta naquele comentário; sem citação → DM (resposta privada
 * ao último comentário se o lead nunca mandou DM).
 *
 * Devolve null (fluxo antigo, da integração única da organização) só quando a conversa não
 * registra por qual conta chegou. Se registra, a resposta sai por essa conta ou falha: cair
 * no fluxo antigo responderia pela conta de outra marca da mesma empresa.
 */
export async function sendInstagramFromChat(input: {
  organizationId: string;
  conversationId: string;
  leadPhone: string;
  text: string;
  quotedMessageInternalId?: string;
}): Promise<{ externalMessageId: string; metadata: InstagramMessageMetadata } | null> {
  const quoted = input.quotedMessageInternalId
    ? await prisma.message.findFirst({
        where: { id: input.quotedMessageInternalId, conversationId: input.conversationId },
        select: { messageId: true, metadata: true },
      })
    : null;
  const quotedInstagram = quoted ? readInstagramMetadata(quoted.metadata) : null;

  const replyChannel = await resolveReplyChannel({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    quotedMetadata: quotedInstagram,
  });
  if (!replyChannel) return null;
  const { channels } = socialRepositoriesForOrganization(input.organizationId);
  const channel = await channels.findWithCredentialsById(replyChannel.channelId);
  if (replyChannel.isFromConversation) {
    if (!channel || channel.status !== "ACTIVE") {
      throw new ORPCError("BAD_REQUEST", {
        message: "A conta do Instagram desta conversa está desativada ou precisa ser reconectada. Reative em Satélites › Instagram para responder.",
      });
    }
  } else if (!channel || channel.credentials.authMode !== "META_LOGIN" || channel.status !== "ACTIVE") {
    return null;
  }
  const gateway = createChannelGateway(channel);
  const failWith = (error: string): never => {
    throw new ORPCError("BAD_REQUEST", { message: `O Instagram recusou: ${error}` });
  };

  if (quoted && quotedInstagram?.kind === "COMMENT") {
    const result = await gateway.replyToComment({ commentId: quoted.messageId, text: input.text });
    if (!result.ok) failWith(result.error);
    return {
      externalMessageId: (result.ok && result.externalMessageId) || `ig-reply-${Date.now()}`,
      metadata: { kind: "COMMENT_REPLY", commentId: quoted.messageId, channelId: channel.id, media: quotedInstagram.media ?? null },
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
    metadata: { kind: "DIRECT_MESSAGE", channelId: channel.id },
  };
}
