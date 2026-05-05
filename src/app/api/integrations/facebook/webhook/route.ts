import { type NextRequest, NextResponse } from "next/server"
import { pusherServer } from "@/lib/pusher"
import prisma from "@/lib/prisma"
import { LeadSource, IntegrationPlatform } from "@/generated/prisma/enums"
import { S3 } from "@/lib/s3-client"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { v4 as uuidv4 } from "uuid"
import { MessageStatus } from "@/features/tracking-chat/types"
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead"
import { logActivity } from "@/features/admin/lib/activity-logger"
import { MessageChannel } from "@/generated/prisma/enums"

// Meta webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token) {
    const integration = await prisma.platformIntegration.findFirst({
      where: {
        platform: IntegrationPlatform.META,
        isActive: true,
        config: { path: ["verify_token"], equals: token },
      },
    })

    if (integration) {
      return new NextResponse(challenge, { status: 200 })
    }
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.object !== "page") {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    for (const entry of body.entry ?? []) {
      const pageId: string = entry.id

      for (const event of entry.messaging ?? []) {
        const senderId: string = event.sender?.id
        const message = event.message

        if (!message || message.is_echo) continue

        const messageId: string = message.mid
        const text: string = message.text ?? ""

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
        })

        if (!integration?.organization?.trackings?.length) continue

        const tracking = integration.organization.trackings[0]
        const trackingId = tracking.id
        const config = integration.config as Record<string, string>
        const pageAccessToken = config.page_access_token

        const remoteJid = `${senderId}@facebook`
        const phone = senderId

        let lead = await prisma.lead.findUnique({
          where: { phone_trackingId: { phone, trackingId } },
          include: { conversation: true, leadTags: { include: { tag: true } } },
        })

        if (!lead) {
          let profileKey: string | null = null

          try {
            const profileRes = await fetch(
              `https://graph.facebook.com/v19.0/${senderId}?fields=name,profile_pic&access_token=${pageAccessToken}`
            )
            if (profileRes.ok) {
              const profile = await profileRes.json()
              if (profile.profile_pic) {
                const imgRes = await fetch(profile.profile_pic)
                if (imgRes.ok) {
                  const buffer = Buffer.from(await imgRes.arrayBuffer())
                  profileKey = `${uuidv4()}.jpg`
                  await S3.send(
                    new PutObjectCommand({
                      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                      Key: profileKey,
                      Body: buffer,
                      ContentType: "image/jpeg",
                    })
                  )
                }
              }
            }
          } catch {}

          const status = await prisma.status.findFirst({
            where: { trackingId },
            select: { id: true },
            orderBy: { order: "asc" },
          })

          if (!status) continue

          const firstLead = await prisma.lead.findFirst({
            where: { statusId: status.id },
            select: { order: true },
            orderBy: { order: "asc" },
          })

          lead = await prisma.lead.create({
            data: {
              name: `Facebook ${senderId}`,
              statusId: status.id,
              phone,
              trackingId,
              source: LeadSource.OTHER,
              profile: profileKey,
              order: firstLead ? Number(firstLead.order) - 1 : 0,
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
          })

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
            })
          } catch {}

          try {
            await prisma.$transaction((tx) => assignLeadRoundRobin(tx, lead!.id))
          } catch {}

          await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${lead.id}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackingId }) }
          )
        } else if (!lead.conversation) {
          await prisma.conversation.create({
            data: { remoteJid, trackingId, isActive: true, leadId: lead.id, channel: MessageChannel.FACEBOOK },
          })
          lead = await prisma.lead.findUnique({
            where: { id: lead.id },
            include: { conversation: true, leadTags: { include: { tag: true } } },
          })
        }

        const existingMsg = await prisma.message.findUnique({ where: { messageId } })
        if (existingMsg) continue

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
        })

        await prisma.conversation.update({
          where: { leadId_trackingId: { leadId: lead!.id, trackingId } },
          data: {
            lastMessage: { connect: { id: messageData.id } },
            lead: { update: { updatedAt: new Date() } },
          },
        })

        await pusherServer.trigger(trackingId, "conversation:new", {
          ...lead!.conversation,
          lead,
        })
        await pusherServer.trigger(lead!.conversation!.id, "message:new", messageData)
        await pusherServer.trigger(trackingId, "message:new", messageData)

        if (lead!.isActive && tracking.globalAiActive && text) {
          await fetch(process.env.WEBHOOK_AI_AGENT_N8N!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "MESSAGE", text, phone, trackingId, leadId: lead!.id }),
          })
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("Facebook Webhook Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
