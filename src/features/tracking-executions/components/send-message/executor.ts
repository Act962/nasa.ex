import { CONSENT_TYPE, FORM_CHAT_TYPE } from "@/features/workflows/lib/conversation-steps";
import { GROUP_MESSAGE_TYPE } from "@/features/workflows/lib/group-message";
import { hasPlaceholderText } from "@/features/workflows/lib/placeholder-text";
import { sendText } from "@/http/uazapi/send-text";
import { formatNumberedMenu, isButtonsOfficialOnly, numberedMenuMetadata } from "@/features/tracking-chat/lib/numbered-menu";
import { NodeExecutor } from "@/features/tracking-executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { SendMessageFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { sendTextMessage } from "./message/send-text-message";
import { sendImageMessage } from "./message/send-image";
import { sendDocumentMessage } from "./message/send-document";
import { sendButtonsOrList, sendItemsAsList } from "@/http/uazapi/send-menu";
import {
  isLeadWindowOpen,
  isPhoneWindowOpen,
  requireUazapiMenuCredentials,
  resolveWorkflowProvider,
  WINDOW_CLOSED_MESSAGE,
} from "../../lib/workflow-outbound";
import {
  assertTemplateSendable,
  assertTemplateSupported,
  ensureLeadConversation,
  sendTemplateMessage,
  toWorkflowTemplateContent,
} from "../../lib/send-template-to-lead";
import { sendMessageChannel } from "@/inngest/channels/send-message";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { normalizePhone } from "@/utils/format-phone";
import { countries } from "@/types/some";
import dayjs from "dayjs";
import { applyVariables, firstNameOf } from "../../lib/interpolate-message";
import {
  colorsByTemperature,
  LeadSourceColors,
} from "@/features/tracking-chat/utils/card-lead";

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
      "{{primeiro_nome}}": firstNameOf(lead.name),
      "{{email}}": lead.email || "",
      "{{phone}}": lead.phone || "",
      "{{contato}}": lead.phone || "",
      "{{data}}": dayjs(lead.createdAt).format("DD/MM/YYYY"),
      "{{data-t}}": dayjs(lead.createdAt).format("DD/MM/YYYY HH:mm"),
      "{{temp}}":
        colorsByTemperature[lead.temperature]?.label || lead.temperature,
      "{{fonte}}": LeadSourceColors[lead.source]?.label || lead.source,
      "{{track}}": lead.tracking.name,
      "{{status}}": lead.status.name,
      "{{public_link}}": (() => {
        const token = (lead as unknown as { publicToken?: string | null })
          .publicToken;
        if (!token) return "";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        return `${baseUrl}/public/lead/${token}`;
      })(),
      "{{sei_protocolo}}": String(
        (context.sei as Record<string, unknown> | undefined)?.protocolo ?? "",
      ),
      "{{sei_andamento}}": String(
        (context.sei as Record<string, unknown> | undefined)?.ultimoAndamento ?? "",
      ),
      "{{sei_especificacao}}": String(
        (context.sei as Record<string, unknown> | undefined)?.especificacao ?? "",
      ),
      "{{sei_link}}": String(
        (context.sei as Record<string, unknown> | undefined)?.linkAcesso ?? "",
      ),
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

      const resolved = await resolveWorkflowProvider(lead.trackingId);
      const typeMessage = data.action?.payload.type;
      const isTemplate = typeMessage === "TEMPLATE";
      if (isTemplate) assertTemplateSupported(resolved);

      const target = data.action?.target;

      // Fora da janela de 24h a API Oficial só aceita template: vai o
      // template reserva do passo, ou o passo falha.
      const fallbackTemplate = data.action?.fallbackTemplate ?? null;
      const isCustomTarget = target?.sendMode === "CUSTOM";
      const customPhone = isCustomTarget
        ? (countries
            .find((country) => country.code === target.code)
            ?.ddi.replace(/\D/g, "") ?? "") + normalizePhone(target.phone)
        : null;
      // Número customizado: vale a janela do lead dono daquele telefone.
      const isWindowOpen = customPhone
        ? await isPhoneWindowOpen(resolved, {
            trackingId: lead.trackingId,
            phone: customPhone,
          })
        : await isLeadWindowOpen(resolved, {
            leadId: lead.id,
            trackingId: lead.trackingId,
          });
      const isWindowClosed = !isTemplate && !isWindowOpen;
      if (isWindowClosed && !fallbackTemplate) {
        throw new NonRetriableError(WINDOW_CLOSED_MESSAGE);
      }

      const existingConversation = await prisma.conversation.findFirst({
        where: {
          leadId: lead.id,
          trackingId: lead.trackingId,
        },
      });

      // Template (o do passo ou o reserva) abre conversa; os demais tipos
      // respondem a uma que já existe.
      const opensConversation = isTemplate || isWindowClosed;
      const conversationId =
        existingConversation?.id ??
        (opensConversation && lead.phone
          ? await ensureLeadConversation(lead.trackingId, {
              id: lead.id,
              phone: lead.phone,
            })
          : null);

      if (!conversationId) {
        if (realTime) {
          await publish(
            sendMessageChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError(
          lead.phone ? "Conversation not found" : "Lead phone is missing",
        );
      }

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

      const phone: string = customPhone ?? lead.phone;

      // Template do passo ou template reserva, já com as variáveis do lead.
      // Validado aqui, antes da cobrança.
      const templateToSend = isTemplate
        ? toWorkflowTemplateContent(data.action?.payload, (parameter) =>
            applyVariables(parameter, variables),
          )
        : isWindowClosed
          ? toWorkflowTemplateContent(fallbackTemplate, (parameter) =>
              applyVariables(parameter, variables),
            )
          : null;
      if (isTemplate && !templateToSend) {
        throw new NonRetriableError("Selecione um template aprovado");
      }
      if (templateToSend) assertTemplateSendable(resolved, templateToSend);

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

      if (templateToSend) {
        await sendTemplateMessage({
          resolved,
          conversationId,
          toPhone: phone,
          template: templateToSend,
        });
      } else {
      // Só sem template reserva: com ele, o template já foi enviado no lugar do conteúdo livre.
      // Última barreira (spec 0097): texto de exemplo do modelo de atendimento nunca chega a um cliente.
      if (hasPlaceholderText(data.action?.payload)) {
        throw new NonRetriableError("Mensagem com texto de exemplo (\"[Escreva aqui…]\") não foi enviada. Troque o texto no passo.");
      }
      // Passos de conversa (spec 0099) dependem do motor do modo agente, que sabe esperar a resposta.
      // O tipo deste quadro não lista os passos de conversa: eles são gravados pelas janelas próprias.
      const stepType: string = String(typeMessage ?? "");
      if (stepType === CONSENT_TYPE || stepType === FORM_CHAT_TYPE || stepType === GROUP_MESSAGE_TYPE) {
        throw new NonRetriableError("Este passo só funciona em fluxo no modo agente.");
      }
      switch (typeMessage) {
        case "TEXT":
          let message = data.action?.payload.message || "";

          for (const [key, value] of Object.entries(variables)) {
            message = message.replace(key, value || "");
          }

          await sendTextMessage({
            body: message,
            conversationId,
            leadPhone: phone,
            provider: resolved.provider,
          });

          break;
        case "IMAGE":
          let caption = data.action?.payload.caption || "";

          for (const [key, value] of Object.entries(variables)) {
            caption = caption.replace(key, value || "");
          }

          await sendImageMessage({
            body: caption,
            conversationId,
            leadPhone: phone,
            provider: resolved.provider,
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
            conversationId,
            leadPhone: phone,
            provider: resolved.provider,
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
            menuFormat?: "BUTTON" | "LIST";
            listButton?: string;
            buttons?: Array<{ text: string; id: string; tagId?: string }>;
          };

          let bodyText = "";
          let footerText: string | undefined;
          let menuFormat: "BUTTON" | "LIST" = "BUTTON";
          let listButton: string | undefined;
          let buttons: Array<{ text: string; id: string; tagId?: string }> = [];

          if (payload?.mode === "preset" && payload.presetId) {
            const preset = await prisma.aiButtonPreset.findUnique({
              where: { id: payload.presetId },
              select: {
                bodyText: true,
                footerText: true,
                buttons: true,
                menuFormat: true,
                listButton: true,
                isActive: true,
              },
            });
            if (!preset || !preset.isActive) {
              throw new NonRetriableError(
                "Preset de botões não encontrado ou inativo",
              );
            }
            if (hasPlaceholderText([preset.bodyText, preset.footerText])) {
              throw new NonRetriableError("Menu com texto de exemplo (\"[Escreva aqui…]\") não foi enviado. Troque o texto do menu.");
            }
            bodyText = preset.bodyText;
            footerText = preset.footerText ?? undefined;
            menuFormat = preset.menuFormat === "LIST" ? "LIST" : "BUTTON";
            listButton = preset.listButton ?? undefined;
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
                    tagId: typeof b.tagId === "string" ? b.tagId : undefined,
                  }))
                  .filter((b) => b.text && b.id)
              : [];
          } else {
            bodyText = payload?.bodyText ?? "";
            footerText = payload?.footerText || undefined;
            menuFormat = payload?.menuFormat === "LIST" ? "LIST" : "BUTTON";
            listButton = payload?.listButton || undefined;
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

          const menuCredentials = requireUazapiMenuCredentials(resolved);

          // Envia como botões OU lista conforme `menuFormat`. Lista reusa a
          // mesma composição de itens (`sendItemsAsList` embrulha numa seção).
          const asList = menuFormat === "LIST";
          // Número fora da API oficial (spec 0095): o menu sai como texto numerado.
          const isSentAsNumberedText = isButtonsOfficialOnly();
          const numberedOptions = buttons.filter((button) => button.id).map((button) => ({ id: button.id, title: button.text }));
          const numberedText = formatNumberedMenu({ body: bodyText, options: numberedOptions, footer: footerText });
          const buttonsResponse = isSentAsNumberedText
            ? await sendText(menuCredentials.token, { number: phone, text: numberedText, readchat: true, readmessages: true, delay: 2000 }, menuCredentials.baseUrl)
            : asList
            ? await sendItemsAsList(
                menuCredentials.token,
                {
                  number: phone,
                  text: bodyText,
                  items: buttons,
                  footer: footerText,
                  button: listButton,
                  readchat: true,
                  readmessages: true,
                  delay: 2000,
                },
                menuCredentials.baseUrl,
              )
            : await sendButtonsOrList(
                menuCredentials.token,
                {
                  number: phone,
                  text: bodyText,
                  buttons,
                  footer: footerText,
                  readchat: true,
                  readmessages: true,
                  delay: 2000,
                },
                menuCredentials.baseUrl,
              );

          // Persiste Message no banco com format espelhado da produção
          // (tool do Chatbot IA → lib/persist linha 57-58). Garante que o
          // histórico do chat fica idêntico independente do canal (IA vs
          // automação).
          const summary = buttons.map((b) => `• ${b.text}`).join("\n");
          const menuHeader = asList
            ? `[Lista: ${listButton?.trim() || "Ver opções"}]`
            : "[Botões]";
          const persistedBody = isSentAsNumberedText
            ? numberedText
            : footerText
              ? `${bodyText}\n\n${menuHeader}\n${summary}\n\n${footerText}`
              : `${bodyText}\n\n${menuHeader}\n${summary}`;

          // Mapa buttonId→tagId para disparar automações LEAD_TAGGED quando
          // o lead clicar num botão com tag associada. Montado a partir dos
          // `buttons` já resolvidos — funciona tanto pro modo inline quanto
          // pro preset (ambos carregam `tagId` por botão agora).
          const buttonTagMap: Record<string, string> = {};
          for (const button of buttons) {
            if (button.id && button.tagId) {
              buttonTagMap[button.id] = button.tagId;
            }
          }
          const hasTagMap = Object.keys(buttonTagMap).length > 0;

          const { MessageStatus: MessageStatusEnum } =
            await import("@/features/tracking-chat/types");
          const { pusherServer: pusher } = await import("@/lib/pusher");
          const message = await prisma.message.create({
            data: {
              conversationId,
              body: persistedBody,
              messageId: buttonsResponse.messageid,
              fromMe: true,
              status: MessageStatusEnum.SENT,
              quotedMessageId: null,
              ...(hasTagMap || isSentAsNumberedText
                ? { metadata: { ...(hasTagMap ? { buttonTagMap } : {}), ...(isSentAsNumberedText ? numberedMenuMetadata(numberedOptions) : {}) } }
                : {}),
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
