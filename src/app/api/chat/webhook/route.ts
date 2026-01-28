import { type NextRequest, NextResponse } from "next/server";
import z from "zod";
import { saveLead } from "@/http/actions/lead";
import { saveConversation } from "@/http/actions/conversation";
import { saveMessage } from "@/http/actions/message";
import { TypeMessage } from "@/http/uazapi/types";
import { _uuid } from "better-auth";

//Endpoint: https://neglectful-berta-preconceptional.ngrok-free.dev/api/chat/webhook?trackingId=cmjmw5z3q0000t0vamxz21061
const schema = z.object({
  chat: z.object({
    image: z.string().optional(),
    imagePreview: z.string().optional(),
  }),
  message: z.object({
    sender: z.string(),
    id: z.string(),
    senderName: z.string(),
    text: z.string().optional(),
    messageType: z.custom<TypeMessage>(),
  }),
  owner: z.string(),
  token: z.string(),
});

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("trackingId");

  if (!trackingId) {
    return NextResponse.json({ error: "trackingId is required" });
  }

  const json = await request.json();
  console.log(json);
  const result = schema.safeParse(json);

  if (!result.success) {
    return NextResponse.json({ error: result.error });
  }

  const body = result.data;

  const lead = await saveLead({
    name: body.message.senderName,
    phone: body.message.sender,
    remoteJid: body.message.id,
    trackingId: trackingId,
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" });
  }

  const conversation = await saveConversation({
    remoteJid: body.message.id,
    trackingId: trackingId,
    leadId: lead.id,
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" });
  }

  await saveMessage({
    senderId: body.message.sender,
    messageId: body.message.id,
    trackingId: trackingId,
    conversationId: conversation.id,
    phone: body.message.sender,
    fromMe: false,
    body: body.message.text,
    type: body.message.messageType,
  });

  return NextResponse.json(201, {});
}
