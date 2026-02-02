"use server";

import { type NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/http/actions/lead";
import { saveConversation } from "@/http/actions/conversation";
import { saveMessage } from "@/http/actions/message";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";

//Endpoint: https://neglectful-berta-preconceptional.ngrok-free.dev/api/chat/webhook?trackingId=cmjmw5z3q0000t0vamxz21061

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("trackingId");

  if (!trackingId) {
    return NextResponse.json({ error: "trackingId is required" });
  }

  const json = await request.json();
  console.log(json);

  if (json.EventType === "messages") {
    const fromMe = json.message.fromMe;
    const remoteJid = json.message.chatid;
    const name = fromMe ? json.chat.name : json.message.senderName;
    const phone = fromMe
      ? json.chat.phone.replace(/\D/g, "")
      : json.message.sender.replace(/\D/g, "");

    const lead = await saveLead({
      name,
      phone,
      remoteJid,
      trackingId,
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" });
    }

    const conversation = await saveConversation({
      remoteJid,
      trackingId,
      leadId: lead.id,
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" });
    }

    const senderId = fromMe ? json.owner : phone;

    const message = await saveMessage({
      senderId,
      messageId: json.message.id,
      trackingId,
      conversationId: conversation.id,
      phone,
      fromMe,
      body: json.message.text,
      type: json.message.messageType,
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" });
    }

    try {
      await pusherServer.trigger(conversation.id, "message:new", message);
    } catch (e) {
      console.log("Pusher Error:", e);
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
