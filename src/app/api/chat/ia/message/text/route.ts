import { CreatedMessageProps } from "@/features/tracking-chat/types";
import { MessageStatus } from "@/generated/prisma/enums";
import { sendText } from "@/http/uazapi/send-text";
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
        whatsappInstances: {
          select: {
            apiKey: true,
            baseUrl: true,
          },
        },
      },
    });

    if (!tracking) {
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

    const response = await sendText(tracking.whatsappInstances[0].apiKey, {
      text: message,
      number: phone,
      delay: 2000,
    });

    const sendedMessage = await prisma.message.create({
      data: {
        body: message,
        fromMe: true,
        messageId: response.messageid,
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
