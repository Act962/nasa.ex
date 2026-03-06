import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { SendMessageFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { sendTextMessage } from "./message/send-text-message";
import { sendImageMessage } from "./message/send-image";
import { sendDocumentMessage } from "./message/send-document";
import { sendMessageChannel } from "@/inngest/channels/send-message";
import { normalizePhone } from "@/utils/format-phone";
import { countries } from "@/types/some";

type SendMessageNodeData = {
  action?: SendMessageFormValues;
};

export const sendMessageExecutor: NodeExecutor<SendMessageNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  console.log("Contexto", context);
  const result = await step.run("send-message", async () => {
    const lead = context.lead as LeadContext;
    const realTime = context.realTime as boolean;

    const variables = {
      "{{name}}": lead.name,
      "{{email}}": lead.email,
      "{{phone}}": lead.phone,
    };

    try {
      if (realTime) {
        await publish(
          sendMessageChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }

      if (!lead) {
        if (realTime) {
          await publish(
            sendMessageChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Lead not found");
      }

      const instance = await prisma.whatsAppInstance.findFirst({
        where: {
          trackingId: lead.trackingId,
        },
      });

      if (!instance) {
        if (realTime) {
          await publish(
            sendMessageChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }

        throw new NonRetriableError("Instance not found");
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          leadId: lead.id,
          trackingId: lead.trackingId,
        },
      });

      if (!conversation) {
        if (realTime) {
          await publish(
            sendMessageChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Conversation not found");
      }

      const typeMessage = data.action?.payload.type;
      const target = data.action?.target;
      let phone = lead.phone;

      if (target?.sendMode === "CUSTOM") {
        const country = countries.find((c) => c.code === target.code);
        const ddi = country?.ddi.replace(/\D/g, "") || "";
        phone = ddi + normalizePhone(target.phone);
      }

      switch (typeMessage) {
        case "TEXT":
          let message = data.action?.payload.message || "";

          for (const [key, value] of Object.entries(variables)) {
            message = message.replace(key, value || "");
          }

          await sendTextMessage({
            body: message,
            conversationId: conversation.id,
            leadPhone: phone,
            token: instance.apiKey,
          });

          break;
        case "IMAGE":
          let caption = data.action?.payload.caption || "";

          for (const [key, value] of Object.entries(variables)) {
            caption = caption.replace(key, value || "");
          }

          await sendImageMessage({
            body: caption,
            conversationId: conversation.id,
            leadPhone: phone,
            token: instance.apiKey,
            mediaUrl: data.action?.payload.imageUrl || "",
          });
          break;
        case "DOCUMENT":
          let documentCaption = data.action?.payload.caption || "";

          for (const [key, value] of Object.entries(variables)) {
            documentCaption = documentCaption.replace(key, value || "");
          }

          await sendDocumentMessage({
            body: documentCaption,
            conversationId: conversation.id,
            leadPhone: phone,
            token: instance.apiKey,
            mediaUrl: data.action?.payload.documentUrl || "",
            fileName: data.action?.payload.fileName || "",
          });
          break;
      }

      if (realTime) {
        await publish(
          sendMessageChannel().status({
            nodeId,
            status: "success",
          }),
        );
      }

      return {
        ...context,
      };
    } catch (error) {
      if (realTime) {
        await publish(
          sendMessageChannel().status({
            nodeId,
            status: "error",
          }),
        );
      }
      throw error;
    }
  });

  return result;
};
