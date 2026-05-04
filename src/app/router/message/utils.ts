import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";

export async function attendLeadIfWaiting(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, statusFlow: true },
  });

  if (!lead || lead.statusFlow === "ACTIVE" || lead.statusFlow === "FINISHED") return;

  await prisma.lead.update({
    where: { id: lead.id },
    data: { statusFlow: "ACTIVE" },
  });
}

const URL_REGEX = /https?:\/\/\S+/i;

export async function logChatMessageSent(params: {
  organizationId: string | null | undefined;
  conversationId: string;
  channel: string;
  user: { id: string; name: string; email: string; image?: string | null };
  messageId: string;
  body: string;
  mediaType?: "audio" | "image" | "file" | "text";
  leadId: string;
  leadName: string;
}) {
  if (!params.organizationId) return;
  const hasLink = URL_REGEX.test(params.body ?? "");
  const baseLog = {
    organizationId: params.organizationId,
    userId: params.user.id,
    userName: params.user.name,
    userEmail: params.user.email,
    userImage: params.user.image,
    appSlug: "chat",
    subAppSlug: "tracking-chat",
    resource: "message",
    resourceId: params.messageId,
    metadata: {
      conversationId: params.conversationId,
      channel: params.channel,
      leadId: params.leadId,
      leadName: params.leadName,
      length: (params.body ?? "").length,
      mediaType: params.mediaType ?? "text",
      hasLink,
    },
  };
  await logActivity({
    ...baseLog,
    action: "message.sent",
    actionLabel: `Enviou mensagem para "${params.leadName}"`,
    featureKey:
      params.mediaType && params.mediaType !== "text"
        ? `chat.${params.mediaType}.sent`
        : "chat.message.sent",
  });
  if (hasLink) {
    await logActivity({
      ...baseLog,
      action: "link.sent",
      actionLabel: `Enviou link para "${params.leadName}"`,
      featureKey: "chat.link.sent",
    });
  }
}
