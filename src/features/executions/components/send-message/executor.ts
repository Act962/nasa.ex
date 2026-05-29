import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { SendMessageFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { sendTextMessage } from "./message/send-text-message";
import { sendImageMessage } from "./message/send-image";
import { sendDocumentMessage } from "./message/send-document";
import { sendMessageChannel } from "@/inngest/channels/send-message";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { normalizePhone } from "@/utils/format-phone";
import { countries } from "@/types/some";
import dayjs from "dayjs";
import { colorsByTemperature, LeadSourceColors } from "@/features/tracking-chat/utils/card-lead";

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
    const leadContext = context.lead as LeadContext;
    const realTime = context.realTime as boolean;

    const lead = await prisma.lead.findUnique({
      where: { id: leadContext.id },
      include: {
        status: true,
        tracking: true,
      },
    });

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

    const variables = {
      "{{name}}": lead.name,
      "{{nome}}": lead.name,
      "{{email}}": lead.email || "",
      "{{phone}}": lead.phone || "",
      "{{contato}}": lead.phone || "",
      "{{data}}": dayjs(lead.createdAt).format("DD/MM/YYYY"),
      "{{data-t}}": dayjs(lead.createdAt).format("DD/MM/YYYY HH:mm"),
      "{{temp}}": colorsByTemperature[lead.temperature]?.label || lead.temperature,
      "{{fonte}}": LeadSourceColors[lead.source]?.label || lead.source,
      "{{track}}": lead.tracking.name,
      "{{status}}": lead.status.name,
      "{{public_link}}": (() => {
        const token = (lead as unknown as { publicToken?: string | null }).publicToken;
        if (!token) return "";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        return `${baseUrl}/public/lead/${token}`;
      })(),
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
      if (!lead.phone) {
        if (realTime) {
          await publish(
            sendMessageChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Lead phone is missing");
      }

      let phone: string = lead.phone;

      if (target?.sendMode === "CUSTOM") {
        const country = countries.find((c) => c.code === target.code);
        const ddi = country?.ddi.replace(/\D/g, "") || "";
        phone = ddi + normalizePhone(target.phone);
      }

      const charge = await chargeStarsByAction(
        lead.tracking.organizationId,
        "message_send",
        {
          appSlug: "message_send",
          description: `Workflow tracking — send-message (${typeMessage})`,
        },
      );
      if (!charge.success) {
        if (realTime) {
          await publish(
            sendMessageChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Saldo de STARs insuficiente.");
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
