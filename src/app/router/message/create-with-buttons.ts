import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { CreatedMessageProps, MessageStatus } from "@/features/tracking-chat/types";
import { sendButtons, sendList } from "@/http/uazapi/send-menu";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { ORPCError } from "@orpc/server";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { triggerFirstChatInteractionIfFirst } from "./utils";

const buttonSchema = z.object({
  text: z.string().min(1).max(20),
  id: z.string().min(1).max(256),
});

const listRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(24),
  description: z.string().max(72).optional(),
});

const listSectionSchema = z.object({
  title: z.string().max(24).optional(),
  rows: z.array(listRowSchema).min(1).max(10),
});

export const createButtonsMessage = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Send interactive buttons/list message" })
  .input(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("buttons"),
        conversationId: z.string(),
        leadPhone: z.string(),
        token: z.string(),
        baseUrl: z.string().optional(),
        text: z.string().min(1).max(1024),
        footer: z.string().max(60).optional(),
        buttons: z.array(buttonSchema).min(1).max(3),
      }),
      z.object({
        type: z.literal("list"),
        conversationId: z.string(),
        leadPhone: z.string(),
        token: z.string(),
        baseUrl: z.string().optional(),
        text: z.string().min(1).max(4096),
        footer: z.string().max(60).optional(),
        button: z.string().min(1).max(20),
        sections: z.array(listSectionSchema).min(1).max(10),
      }),
    ]),
  )
  .handler(async ({ input, context }) => {
    let externalMessageId = uuidv4();

    // Constrói o texto resumido para salvar no DB
    let bodyText: string;

    if (input.type === "buttons") {
      try {
        const r = await sendButtons(
          input.token,
          {
            number: input.leadPhone,
            text: input.text,
            footer: input.footer,
            buttons: input.buttons,
            readchat: true,
            readmessages: true,
          },
          input.baseUrl,
        );
        if (r?.messageid) externalMessageId = r.messageid;
      } catch (err: any) {
        throw new ORPCError("BAD_REQUEST", {
          message: `UAZAPI: ${err?.message ?? "Erro ao enviar botões"}`,
        });
      }

      const btnList = input.buttons.map((b) => `• ${b.text}`).join("\n");
      bodyText = `${input.text}\n\n[Botões]\n${btnList}`;
    } else {
      try {
        const r = await sendList(
          input.token,
          {
            number: input.leadPhone,
            text: input.text,
            footer: input.footer,
            button: input.button,
            sections: input.sections,
            readchat: true,
            readmessages: true,
          },
          input.baseUrl,
        );
        if (r?.messageid) externalMessageId = r.messageid;
      } catch (err: any) {
        throw new ORPCError("BAD_REQUEST", {
          message: `UAZAPI: ${err?.message ?? "Erro ao enviar lista"}`,
        });
      }

      const rowList = input.sections
        .flatMap((s) => s.rows)
        .map((r) => `• ${r.title}`)
        .join("\n");
      bodyText = `${input.text}\n\n[Lista: ${input.button}]\n${rowList}`;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        body: bodyText,
        messageId: externalMessageId,
        fromMe: true,
        status: MessageStatus.SENT,
        senderName: context.user.name,
      },
      select: {
        id: true,
        messageId: true,
        body: true,
        createdAt: true,
        fromMe: true,
        status: true,
        mediaUrl: true,
        mediaType: true,
        mediaCaption: true,
        mimetype: true,
        fileName: true,
        quotedMessageId: true,
        conversationId: true,
        senderId: true,
        senderName: true,
        conversation: {
          select: {
            id: true,
            lead: { select: { id: true, name: true } },
          },
        },
        quotedMessage: {
          include: { conversation: { include: { lead: true } } },
        },
      },
    });

    const messageCreated: CreatedMessageProps = {
      ...message,
      currentUserId: context.user.id,
    };

    await pusherServer.trigger(message.conversationId, "message:created", messageCreated);

    await triggerFirstChatInteractionIfFirst({
      conversationId: input.conversationId,
      leadId: message.conversation.lead.id,
    });

    return { message };
  });
