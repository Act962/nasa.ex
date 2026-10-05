import "server-only";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { LeadSource, MessageChannel } from "@/generated/prisma/enums";
import { MessageStatus } from "@/features/tracking-chat/types";
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { applyInboundAutoTags, loadAwaitingState } from "@/features/org-defaults/lib/auto-tags";
import { AUTO_TAG_SLUGS, DEFAULT_TAGS } from "@/features/org-defaults/lib/default-org-template";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { truncateLeadMessageText } from "@/features/tracking-executions/lib/lead-message";
import type { ChannelEventObserver } from "@/modules/social/process-channel-events";
import type { InstagramMessageMetadata } from "../../lib/instagram-message-metadata";
import { fetchInstagramMediaCard, fetchInstagramUserProfile } from "./instagram-graph-lookups";

/**
 * Comentários e DMs do Instagram viram conversa no tracking-chat (spec 0062), para toda conta
 * dos Satélites: conectada pela Meta ou pelo formulário (token do app do Instagram).
 * Roda depois da automação do Comments, fora de transação, e cada efeito é best-effort.
 */

const MESSAGE_INCLUDE = { quotedMessage: true, conversation: { include: { lead: true, lastMessage: true } } } as const;

async function resolveLeadTrackingId(channelId: string, organizationId: string): Promise<string | null> {
  const channel = await prisma.socialChannel.findUnique({ where: { id: channelId }, select: { leadTrackingId: true } });
  if (channel?.leadTrackingId) {
    const chosen = await prisma.tracking.findFirst({ where: { id: channel.leadTrackingId, organizationId }, select: { id: true } });
    if (chosen) return chosen.id;
  }
  const first = await prisma.tracking.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return first?.id ?? null;
}

/** A tag "Instagram" é requisito (RF-4): org antiga sem a tag padrão ganha a tag agora. */
async function ensureInstagramTag(organizationId: string, leadId: string) {
  const template = DEFAULT_TAGS.find((tag) => tag.key === "instagram")!;
  const existing = await prisma.tag.findFirst({
    where: {
      organizationId,
      trackingId: null,
      archivedAt: null,
      OR: [{ slug: AUTO_TAG_SLUGS.instagram }, { name: template.name }],
    },
    select: { id: true },
  });
  const tag =
    existing ??
    (await prisma.tag.create({
      data: { name: template.name, slug: AUTO_TAG_SLUGS.instagram, color: template.color, description: template.description, type: "SYSTEM", organizationId },
      select: { id: true },
    }));
  const alreadyTagged = await prisma.leadTag.findFirst({ where: { leadId, tagId: tag.id }, select: { id: true } });
  if (!alreadyTagged) await applyTagsByAi({ leadId, tagIds: [tag.id] });
}

async function findOrCreateLead(input: {
  organizationId: string;
  trackingId: string;
  igScopedUserId: string;
  username: string | null;
  profilePicUrl: string | null;
  firstMessageText: string;
  firstMessageId: string;
}) {
  const remoteJid = `${input.igScopedUserId}@instagram`;
  const displayName = input.username ? `@${input.username}` : "Instagram";
  const existing = await prisma.lead.findUnique({
    where: { phone_trackingId: { phone: input.igScopedUserId, trackingId: input.trackingId } },
    include: { conversation: true },
  });

  if (existing) {
    // Lead do fluxo antigo nasceu como "Instagram <id>": troca pelo @ quando ele aparece.
    if (input.username && existing.name?.startsWith("Instagram")) {
      await prisma.lead.update({ where: { id: existing.id }, data: { name: displayName } });
    }
    const conversation =
      existing.conversation ??
      (await prisma.conversation.create({
        data: { remoteJid, trackingId: input.trackingId, isActive: true, leadId: existing.id, channel: MessageChannel.INSTAGRAM, profilePicUrl: input.profilePicUrl },
      }));
    return { leadId: existing.id, conversationId: conversation.id, isNew: false };
  }

  const status = await prisma.status.findFirst({ where: { trackingId: input.trackingId }, select: { id: true }, orderBy: { order: "asc" } });
  if (!status) return null;
  const firstLead = await prisma.lead.findFirst({ where: { statusId: status.id }, select: { order: true }, orderBy: { order: "asc" } });

  const lead = await prisma.lead.create({
    data: {
      name: displayName,
      statusId: status.id,
      phone: input.igScopedUserId,
      trackingId: input.trackingId,
      source: LeadSource.INSTAGRAM,
      order: firstLead ? Number(firstLead.order) - 1 : 0,
      lastInboundAt: new Date(),
      conversation: {
        create: { remoteJid, trackingId: input.trackingId, isActive: true, channel: MessageChannel.INSTAGRAM, profilePicUrl: input.profilePicUrl },
      },
    },
    include: { conversation: true },
  });

  await prisma.$transaction((transaction) => assignLeadRoundRobin(transaction, lead.id)).catch(() => undefined);
  await logActivity({
    organizationId: input.organizationId,
    userId: "system",
    userName: "Sistema",
    userEmail: "sistema@nasa",
    appSlug: "tracking",
    action: "lead.arrived",
    actionLabel: `Um lead chegou pelo Instagram (${displayName})`,
    resource: displayName,
    resourceId: lead.id,
    metadata: { source: "INSTAGRAM" },
  }).catch(() => undefined);
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${input.trackingId}&leadId=${lead.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trackingId: input.trackingId,
      leadMessage: { text: truncateLeadMessageText(input.firstMessageText), messageId: input.firstMessageId, sentAt: new Date().toISOString(), source: "TRIGGER_EVENT" },
    }),
  }).catch(() => undefined);

  return { leadId: lead.id, conversationId: lead.conversation!.id, isNew: true };
}

async function publishMessage(trackingId: string, conversationId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: MESSAGE_INCLUDE });
  if (!message) return;
  await pusherServer.trigger(conversationId, "message:new", message).catch(() => undefined);
  await pusherServer.trigger(trackingId, "message:new", message).catch(() => undefined);
}

export const ingestInstagramEventToChat: ChannelEventObserver = async ({ channel, event, result }) => {
  // Comentário ou eco da própria conta não é cliente (CA-7).
  if (event.actor.externalUserId === channel.externalAccountId) return;

  const trackingId = await resolveLeadTrackingId(channel.id, channel.organizationId);
  if (!trackingId) return;
  const graphAccess = { accessToken: channel.credentials.accessToken, authMode: channel.credentials.authMode ?? "INSTAGRAM_LOGIN" };
  const isComment = event.type === "COMMENT_CREATED";

  const alreadyStored = await prisma.message.findUnique({ where: { messageId: event.externalEventId }, select: { id: true } });
  const needsProfile = !event.actor.username;
  const profile = needsProfile ? await fetchInstagramUserProfile(event.actor.externalUserId, graphAccess) : null;
  const username = event.actor.username ?? profile?.username ?? null;

  const lead = await findOrCreateLead({
    organizationId: channel.organizationId,
    trackingId,
    igScopedUserId: event.actor.externalUserId,
    username,
    profilePicUrl: profile?.profile_pic ?? null,
    firstMessageText: event.text,
    firstMessageId: event.externalEventId,
  });
  if (!lead) return;

  const media = isComment && event.content ? await fetchInstagramMediaCard(event.content.externalId, graphAccess) : null;

  if (!alreadyStored) {
    const metadata: InstagramMessageMetadata = isComment
      ? { kind: "COMMENT", commentId: event.externalEventId, channelId: channel.id, media }
      : { kind: "DIRECT_MESSAGE", channelId: channel.id };
    const awaitingState = await loadAwaitingState(lead.leadId).catch(() => null);
    const inbound = await prisma.message.create({
      data: {
        fromMe: false,
        conversationId: lead.conversationId,
        senderId: event.actor.externalUserId,
        messageId: event.externalEventId,
        body: event.text,
        status: MessageStatus.SEEN,
        senderName: username ? `@${username}` : "Instagram",
        metadata: { instagram: metadata },
      },
      select: { id: true },
    });
    await prisma.conversation.update({
      where: { id: lead.conversationId },
      data: { lastMessage: { connect: { id: inbound.id } }, lead: { update: { updatedAt: new Date(), lastInboundAt: new Date() } } },
    });

    await ensureInstagramTag(channel.organizationId, lead.leadId).catch((error) => console.error("[instagram-chat] tag_failed", error));
    await applyInboundAutoTags({
      organizationId: channel.organizationId,
      leadId: lead.leadId,
      channel: "INSTAGRAM",
      wasAwaitingReply: awaitingState?.isAwaitingReply ?? false,
    }).catch((error) => console.error("[instagram-chat] auto_tags_failed", error));
    await trackLeadEvent({ leadId: lead.leadId, kind: "message_in", metadata: { channel: "INSTAGRAM", messageId: event.externalEventId } }).catch(() => undefined);

    if (lead.isNew) {
      const conversation = await prisma.conversation.findUnique({ where: { id: lead.conversationId }, include: { lead: { include: { leadTags: { include: { tag: true } } } } } });
      if (conversation) await pusherServer.trigger(trackingId, "conversation:new", conversation).catch(() => undefined);
    }
    await publishMessage(trackingId, lead.conversationId, inbound.id);
  }

  // Respostas da automação do Comments aparecem na conversa como enviadas (RF-5).
  const deliveries = result && (result.outcome === "SENT" || result.outcome === "FAILED") ? result.deliveries : [];
  for (const [deliveryIndex, delivery] of deliveries.entries()) {
    const deliveryMessageId = delivery.externalMessageId ?? `automation-${event.externalEventId}-${deliveryIndex}`;
    const isStored = await prisma.message.findUnique({ where: { messageId: deliveryMessageId }, select: { id: true } });
    if (isStored) continue;
    const metadata: InstagramMessageMetadata =
      delivery.kind === "REPLY_TO_COMMENT"
        ? { kind: "AUTOMATION_COMMENT_REPLY", commentId: event.externalEventId, channelId: channel.id, media }
        : { kind: "AUTOMATION_DIRECT_MESSAGE", channelId: channel.id, buttons: delivery.buttons };
    const outbound = await prisma.message.create({
      data: {
        fromMe: true,
        conversationId: lead.conversationId,
        messageId: deliveryMessageId,
        body: delivery.text,
        status: MessageStatus.SENT,
        senderName: "Automação do Comments",
        metadata: { instagram: metadata },
      },
      select: { id: true },
    });
    await prisma.conversation.update({ where: { id: lead.conversationId }, data: { lastMessage: { connect: { id: outbound.id } } } });
    await publishMessage(trackingId, lead.conversationId, outbound.id);
  }
};
