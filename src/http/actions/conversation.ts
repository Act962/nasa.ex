import prisma from "@/lib/prisma";

interface conversationProps {
  remoteJid: string;
  trackingId: string;
  leadId: string;
}

export async function saveConversation(body: conversationProps) {
  try {
    const status = await prisma.status.findFirst({
      where: {
        trackingId: body.trackingId,
      },
    });

    if (!status) {
      return;
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        leadId_trackingId: {
          leadId: body.leadId,
          trackingId: body.trackingId,
        },
      },
      update: {},
      create: {
        leadId: body.leadId,
        remoteJid: body.remoteJid,
        trackingId: body.trackingId,
        isActive: true,
      },
    });
    return conversation;
  } catch (e) {
    console.log(e);
  }
}
