/**
 * Handler agnóstico de framework do webhook do Facebook Messenger (verificação
 * Meta + inbound de DM → lead). A Meta NÃO assina este endpoint (lookup por
 * page_id); recebemos o corpo cru e parseamos aqui. Compartilhado entre o route
 * Next (apps/web) e a rota Fastify (apps/api).
 */
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";
import { LeadSource, IntegrationPlatform } from "@/generated/prisma/enums";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { MessageStatus } from "@/features/tracking-chat/types";
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { MessageChannel } from "@/generated/prisma/enums";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  resolveReferralForOrg,
  ctwaToLeadData,
  captureMetaReferralForNewLead,
} from "@/lib/lead-journey/ctwa";

export type WebhookResult = { status: number; body: unknown; text?: boolean };

export async function handleFacebookVerify(params: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}): Promise<WebhookResult> {
  const { mode, token, challenge } = params;

  if (mode === "subscribe" && token) {
    const integration = await prisma.platformIntegration.findFirst({
      where: {
        platform: IntegrationPlatform.META,
        isActive: true,
        config: { path: ["verify_token"], equals: token },
      },
    });

    if (integration) {
      return { status: 200, body: challenge ?? "", text: true };
    }
  }

  return { status: 403, body: { error: "Forbidden" } };
}

export async function handleFacebookEvent(rawBody: string): Promise<WebhookResult> {
  try {
    const body = JSON.parse(rawBody);

    if (body.object !== "page") {
      return { status: 200, body: { success: true } };
    }

    for (const entry of body.entry ?? []) {
      const pageId: string = entry.id;

      for (const event of entry.messaging ?? []) {
        const senderId: string = event.sender?.id;
        const message = event.message;

        if (!message || message.is_echo) continue;

        const messageId: string = message.mid;
        const text: string = message.text ?? "";

        const integration = await prisma.platformIntegration.findFirst({
          where: {
            platform: IntegrationPlatform.META,
            isActive: true,
            config: { path: ["page_id"], equals: pageId },
          },
          include: {
            organization: {
              include: {
                trackings: {
                  select: { id: true, globalAiActive: true, name: true },
                  take: 1,
                },
              },
            },
          },
        });

        if (!integration?.organization?.trackings?.length) continue;

        const tracking = integration.organization.trackings[0];
        const trackingId = tracking.id;
        const config = integration.config as Record<string, string>;
        const pageAccessToken = config.page_access_token;

        const remoteJid = `${senderId}@facebook`;
        const phone = senderId;

        let lead = await prisma.lead.findUnique({
          where: { phone_trackingId: { phone, trackingId } },
          include: { conversation: true, leadTags: { include: { tag: true } } },
        });

        if (!lead) {
          let profileKey: string | null = null;

          try {
            const profileResponse = await fetch(
              `https://graph.facebook.com/v19.0/${senderId}?fields=name,profile_pic&access_token=${pageAccessToken}`,
            );
            if (profileResponse.ok) {
              const profile = await profileResponse.json();
              if (profile.profile_pic) {
                const imageResponse = await fetch(profile.profile_pic);
                if (imageResponse.ok) {
                  const buffer = Buffer.from(await imageResponse.arrayBuffer());
                  profileKey = `${uuidv4()}.jpg`;
                  await S3.send(
                    new PutObjectCommand({
                      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                      Key: profileKey,
                      Body: buffer,
                      ContentType: "image/jpeg",
                    }),
                  );
                }
              }
            }
          } catch {}

          const status = await prisma.status.findFirst({
            where: { trackingId },
            select: { id: true },
            orderBy: { order: "asc" },
          });

          if (!status) continue;

          const firstLead = await prisma.lead.findFirst({
            where: { statusId: status.id },
            select: { order: true },
            orderBy: { order: "asc" },
          });

          const fbReferral = await resolveReferralForOrg(
            integration.organizationId,
            event,
            message,
          );

          lead = await prisma.lead.create({
            data: {
              name: `Facebook ${senderId}`,
              statusId: status.id,
              phone,
              trackingId,
              source: LeadSource.OTHER,
              profile: profileKey,
              order: firstLead ? Number(firstLead.order) - 1 : 0,
              lastInboundAt: new Date(),
              ...(fbReferral
                ? ctwaToLeadData(fbReferral.ref, fbReferral.resolved)
                : {}),
              conversation: {
                create: {
                  remoteJid,
                  trackingId,
                  isActive: true,
                  channel: MessageChannel.FACEBOOK,
                },
              },
            },
            include: { conversation: true, leadTags: { include: { tag: true } } },
          });

          try {
            await logActivity({
              organizationId: integration.organizationId,
              userId: "system",
              userName: "Sistema",
              userEmail: "sistema@nasa",
              appSlug: "tracking",
              action: "lead.arrived",
              actionLabel: `Um lead chegou via Facebook Messenger (${senderId})`,
              resource: lead.name ?? phone,
              resourceId: lead.id,
              metadata: { phone, trackingName: tracking.name, source: "FACEBOOK" },
            });
          } catch {}

          if (fbReferral) {
            await captureMetaReferralForNewLead(
              lead.id,
              fbReferral.ref,
              fbReferral.resolved,
              "FACEBOOK",
            );
          }

          try {
            await prisma.$transaction((tx) => assignLeadRoundRobin(tx, lead!.id));
          } catch {}

          await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${lead.id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trackingId }),
            },
          );
        } else if (!lead.conversation) {
          await prisma.conversation.create({
            data: {
              remoteJid,
              trackingId,
              isActive: true,
              leadId: lead.id,
              channel: MessageChannel.FACEBOOK,
            },
          });
          lead = await prisma.lead.findUnique({
            where: { id: lead.id },
            include: { conversation: true, leadTags: { include: { tag: true } } },
          });
        }

        const existingMessage = await prisma.message.findUnique({
          where: { messageId },
        });
        if (existingMessage) continue;

        const messageData = await prisma.message.create({
          data: {
            fromMe: false,
            conversationId: lead!.conversation!.id,
            senderId: phone,
            messageId,
            body: text,
            status: MessageStatus.SEEN,
            senderName: lead!.name ?? `Facebook ${senderId}`,
          },
          include: {
            quotedMessage: true,
            conversation: { include: { lead: true, lastMessage: true } },
          },
        });

        await prisma.conversation.update({
          where: { leadId_trackingId: { leadId: lead!.id, trackingId } },
          data: {
            lastMessage: { connect: { id: messageData.id } },
            lead: {
              update: {
                updatedAt: new Date(),
                lastInboundAt: new Date(),
              },
            },
          },
        });

        await trackLeadEvent({
          leadId: lead!.id,
          kind: "message_in",
          metadata: { channel: "FACEBOOK", messageId },
        });

        await pusherServer.trigger(trackingId, "conversation:new", {
          ...lead!.conversation,
          lead,
        });
        await pusherServer.trigger(
          lead!.conversation!.id,
          "message:new",
          messageData,
        );
        await pusherServer.trigger(trackingId, "message:new", messageData);

        if (lead!.isActive && tracking.globalAiActive && text) {
          await fetch(process.env.WEBHOOK_AI_AGENT_N8N!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "MESSAGE",
              text,
              phone,
              trackingId,
              leadId: lead!.id,
            }),
          });
        }
      }
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    console.error("Facebook Webhook Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return { status: 500, body: { error: message } };
  }
}
