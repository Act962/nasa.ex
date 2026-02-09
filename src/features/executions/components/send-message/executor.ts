import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { SendMessageFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { sendTextMessage } from "./message/send-text-message";
import { sendImageMessage } from "./message/send-image";
import { sendDocumentMessage } from "./message/send-document";

type SendMessageNodeData = {
  action?: SendMessageFormValues;
};

export const sendMessageExecutor: NodeExecutor<SendMessageNodeData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  const result = await step.run("send-message", async () => {
    const lead = context.lead as LeadContext;

    if (!lead) {
      throw new NonRetriableError("Lead not found");
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        trackingId: lead.trackingId,
      },
    });

    if (!instance) {
      throw new NonRetriableError("Instance not found");
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        leadId: lead.id,
        trackingId: lead.trackingId,
      },
    });

    if (!conversation) {
      throw new NonRetriableError("Conversation not found");
    }

    const typeMessage = data.action?.payload.type;

    switch (typeMessage) {
      case "TEXT":
        await sendTextMessage({
          body: data.action?.payload.message || "",
          conversationId: conversation.id,
          leadPhone: lead.phone,
          token: instance.apiKey,
        });

        break;
      case "IMAGE":
        await sendImageMessage({
          body: data.action?.payload.caption || "",
          conversationId: conversation.id,
          leadPhone: lead.phone,
          token: instance.apiKey,
          mediaUrl: data.action?.payload.imageUrl || "",
        });
        break;
      case "DOCUMENT":
        await sendDocumentMessage({
          body: data.action?.payload.caption || "",
          conversationId: conversation.id,
          leadPhone: lead.phone,
          token: instance.apiKey,
          mediaUrl: data.action?.payload.documentUrl || "",
          fileName: data.action?.payload.fileName || "",
        });
        break;
    }

    return {
      ...context,
    };
  });

  return result;
};

// cmlf447cu000sywsl5xktbct9

// Tracking: cmlf3qjk80001ywsl6vteyf8o
