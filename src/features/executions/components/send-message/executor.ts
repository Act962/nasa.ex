import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { SendMessageFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { sendTextMessage } from "./message/send-text-message";
import { sendImageMessage } from "./message/send-image";
import { sendDocumentMessage } from "./message/send-document";
import { sendButtonsOrList } from "@/http/uazapi/send-menu";
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
        case "BUTTONS": {
          // Resolve preset OU inline. Preset: lê AiButtonPreset do banco
          // (validação de tracking-scope já foi feita pela UI). Inline:
          // usa os campos do payload.
          // Espelha a mesma lógica do executor agent-mode (apps.ts) pra
          // garantir comportamento idêntico nas 2 engines.
          const payload = data.action?.payload as {
            mode?: "preset" | "inline";
            presetId?: string;
            bodyText?: string;
            footerText?: string;
            buttons?: Array<{ text: string; id: string }>;
          };

          let bodyText = "";
          let footerText: string | undefined;
          let buttons: Array<{ text: string; id: string }> = [];

          if (payload?.mode === "preset" && payload.presetId) {
            const preset = await prisma.aiButtonPreset.findUnique({
              where: { id: payload.presetId },
              select: {
                bodyText: true,
                footerText: true,
                buttons: true,
                isActive: true,
              },
            });
            if (!preset || !preset.isActive) {
              throw new NonRetriableError(
                "Preset de botões não encontrado ou inativo",
              );
            }
            bodyText = preset.bodyText;
            footerText = preset.footerText ?? undefined;
            const rawButtons = preset.buttons as unknown;
            buttons = Array.isArray(rawButtons)
              ? rawButtons
                  .filter(
                    (b): b is Record<string, unknown> =>
                      typeof b === "object" && b !== null,
                  )
                  .map((b) => ({
                    text: typeof b.text === "string" ? b.text : "",
                    id: typeof b.id === "string" ? b.id : "",
                  }))
                  .filter((b) => b.text && b.id)
              : [];
          } else {
            bodyText = payload?.bodyText ?? "";
            footerText = payload?.footerText || undefined;
            buttons = Array.isArray(payload?.buttons) ? payload.buttons : [];
          }

          // Interpolação de variáveis no bodyText/footerText
          for (const [k, v] of Object.entries(variables)) {
            bodyText = bodyText.replace(k, v || "");
            if (footerText) footerText = footerText.replace(k, v || "");
          }

          if (!bodyText.trim()) {
            throw new NonRetriableError("Texto principal do menu vazio");
          }
          if (buttons.length === 0) {
            throw new NonRetriableError("Menu sem botões válidos");
          }

          // Mesma chamada uazapi do tool de produção em
          // `tracking-chat-ai/server/tools/send-buttons.ts`, mas via
          // wrapper `sendButtonsOrList` que auto-degrada pra `sendList`
          // se buttons.length > 3 (limite nativo do WhatsApp).
          const buttonsResponse = await sendButtonsOrList(
            instance.apiKey,
            {
              number: phone,
              text: bodyText,
              buttons,
              footer: footerText,
              readchat: true,
              readmessages: true,
              delay: 2000,
            },
            instance.baseUrl,
          );

          // Persiste Message no banco com format espelhado da produção
          // (tool do Chatbot IA → lib/persist linha 57-58). Garante que o
          // histórico do chat fica idêntico independente do canal (IA vs
          // automação).
          const summary = buttons.map((b) => `• ${b.text}`).join("\n");
          const persistedBody = footerText
            ? `${bodyText}\n\n[Botões]\n${summary}\n\n${footerText}`
            : `${bodyText}\n\n[Botões]\n${summary}`;

          const { MessageStatus: MessageStatusEnum } = await import(
            "@/features/tracking-chat/types"
          );
          const { pusherServer: pusher } = await import("@/lib/pusher");
          const message = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              body: persistedBody,
              messageId: buttonsResponse.messageid,
              fromMe: true,
              status: MessageStatusEnum.SENT,
              quotedMessageId: null,
            },
            include: {
              conversation: { include: { lead: true } },
            },
          });
          await pusher
            .trigger(message.conversationId, "message:created", {
              ...message,
              currentUserId: "",
            })
            .catch(() => {
              // pusher best-effort — message já tá no banco
            });
          break;
        }
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
