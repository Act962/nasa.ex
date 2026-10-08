import { CreatedMessageProps } from "@/features/tracking-chat/types";
import { MessageStatus } from "@/generated/prisma/enums";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import {
  isFreeFormWindowOpen,
  toLegacyUazapiMessageId,
} from "@/features/tracking-chat/lib/providers/automated-outbound";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { NextResponse } from "next/server";
import { z } from "zod";

const formSchema = z.object({
  trackingId: z.string(),
  phone: z.string(),
  conversationId: z.string(),
  message: z.string(),
});

export async function POST(request: Request) {
  try {
    const bodyParsed = formSchema.safeParse(await request.json());

    if (!bodyParsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid body",
        },
        { status: 400 },
      );
    }

    const { trackingId, message, phone, conversationId } = bodyParsed.data;

    const tracking = await prisma.tracking.findUnique({
      where: {
        id: trackingId,
      },
      select: {
        id: true,
        whatsappInstance: { select: { id: true } },
      },
    });

    if (!tracking || !tracking.whatsappInstance) {
      return NextResponse.json(
        {
          status: "error",
          message: "Tracking not found",
        },
        { status: 404 },
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
        trackingId: trackingId,
      },
      select: {
        id: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        {
          status: "error",
          message: "Conversation not found",
        },
        { status: 404 },
      );
    }

    const resolved = await resolveOutboundProvider(trackingId);
    if (!(await isFreeFormWindowOpen(resolved, conversation.id))) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Janela de 24h da API Oficial fechada: só template aprovado pode ser enviado.",
        },
        { status: 409 },
      );
    }

    const sent = await resolved.provider.sendText({
      kind: "text",
      to: phone,
      body: message,
      typingDelayMs: 2000,
    });

    const sendedMessage = await prisma.message.create({
      data: {
        body: message,
        fromMe: true,
        messageId: toLegacyUazapiMessageId(sent),
        status: MessageStatus.SENT,
        conversationId: conversation.id,
      },
      include: {
        conversation: {
          include: {
            lead: true,
          },
        },
      },
    });

    const messageCreated: CreatedMessageProps = {
      ...sendedMessage,
      currentUserId: "",
    };

    await pusherServer.trigger(
      sendedMessage.conversationId,
      "message:created",
      messageCreated,
    );

    return NextResponse.json({
      status: "success",
      message: "Message sent successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
