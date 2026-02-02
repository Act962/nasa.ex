"use server";

import { type NextRequest, NextResponse } from "next/server";
import z from "zod";
import { saveLead } from "@/http/actions/lead";
import { saveConversation } from "@/http/actions/conversation";
import { saveMessage } from "@/http/actions/message";
import { TypeMessage } from "@/http/uazapi/types";
import { _uuid } from "better-auth";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";

//Endpoint: https://neglectful-berta-preconceptional.ngrok-free.dev/api/chat/webhook?trackingId=cmjmw5z3q0000t0vamxz21061

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("trackingId");

  if (!trackingId) {
    return NextResponse.json({ error: "trackingId is required" });
  }

  const json = await request.json();
  console.log(json);

  if (json.EventType === "Message") {
    const lead = await saveLead({
      name: json.message.senderName,
      phone: json.message.sender,
      remoteJid: json.message.id,
      trackingId: trackingId,
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" });
    }

    const conversation = await saveConversation({
      remoteJid: json.message.id,
      trackingId: trackingId,
      leadId: lead.id,
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" });
    }

    const phoneFormated = json.message.sender.replace(/\D/g, "");

    const message = await saveMessage({
      senderId: json.message.sender,
      messageId: json.message.id,
      trackingId: trackingId,
      conversationId: conversation.id,
      phone: phoneFormated,
      fromMe: false,
      body: json.message.text,
      type: json.message.messageType,
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" });
    }

    try {
      await pusherServer.trigger(conversation.id, "message:new", message);
    } catch (e) {
      console.log(e);
    }

    return NextResponse.json(201, {});
  }

  if (json.EventType === "connection") {
    if (json.instance.status === "disconnected") {
      await prisma.whatsAppInstance.deleteMany({
        where: {
          apiKey: json.token,
        },
      });
    }
    return NextResponse.json(201, {});
  }
  return NextResponse.json(404, {});
}
