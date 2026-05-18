import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";
import { MessageStatus } from "@/generated/prisma/enums";
import type { WhatsappChat } from "@/features/form/types";

export type FormWhatsappSendEvent = {
  data: {
    formId: string;
    formName: string;
    trackingId: string;
    whatsappChats: WhatsappChat[];
    whatsappMessage?: string | null;
    leadData: {
      id: string | null;
      name: string | null;
      phone: string | null;
      email: string | null;
    };
  };
};

// ── Tipos e helpers para resolveMessage ─────────────────────────────────────

type MessageVars = {
  name: string | null;
  email: string | null;
  phone: string | null;
  formName: string;
  temperature: string | null;
  source: string | null;
  trackingName: string | null;
  statusName: string | null;
  publicToken: string | null;
  createdAt: Date | null;
};

const TEMPERATURE_LABELS: Record<string, string> = {
  COLD: "Frio",
  WARM: "Morno",
  HOT: "Quente",
};

const SOURCE_LABELS: Record<string, string> = {
  FORM: "Formulário",
  MANUAL: "Manual",
  DEFAULT: "Padrão",
  IMPORT: "Importação",
  API: "API",
  WHATSAPP: "WhatsApp",
};

function formatDate(date: Date | null, withTime = false): string {
  if (!date) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/**
 * Resolve a mensagem final a partir de um template com variáveis ou retorna
 * a mensagem padrão quando o template está vazio.
 *
 * Variáveis suportadas (mesmas de variables.ts):
 * {{nome}}, {{name}}, {{email}}, {{phone}}, {{contato}},
 * {{data}}, {{data-t}}, {{temp}}, {{fonte}}, {{track}},
 * {{status}}, {{public_link}}, {{formulario}}.
 */
function resolveMessage(
  template: string | null | undefined,
  vars: MessageVars,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const publicLink = vars.publicToken
    ? `${baseUrl}/lead/${vars.publicToken}`
    : "";

  const defaultMsg = [
    `📋 *Novo formulário recebido!*`,
    ``,
    `*Formulário:* ${vars.formName}`,
    vars.name ? `*Nome:* ${vars.name}` : null,
    vars.phone ? `*Telefone:* ${vars.phone}` : null,
    vars.email ? `*E-mail:* ${vars.email}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!template?.trim()) return defaultMsg;

  return template
    .replaceAll("{{nome}}", vars.name ?? "")
    .replaceAll("{{name}}", vars.name ?? "")
    .replaceAll("{{email}}", vars.email ?? "")
    .replaceAll("{{phone}}", vars.phone ?? "")
    .replaceAll("{{contato}}", vars.phone ?? "")
    .replaceAll("{{data}}", formatDate(vars.createdAt, false))
    .replaceAll("{{data-t}}", formatDate(vars.createdAt, true))
    .replaceAll(
      "{{temp}}",
      TEMPERATURE_LABELS[vars.temperature ?? ""] ?? vars.temperature ?? "",
    )
    .replaceAll(
      "{{fonte}}",
      SOURCE_LABELS[vars.source ?? ""] ?? vars.source ?? "",
    )
    .replaceAll("{{track}}", vars.trackingName ?? "")
    .replaceAll("{{status}}", vars.statusName ?? "")
    .replaceAll("{{public_link}}", publicLink)
    .replaceAll("{{formulario}}", vars.formName);
}

/**
 * Inngest: dispara quando um formulário é submetido e há chats WhatsApp
 * configurados nas settings.
 *
 * Regras:
 *  - Grupo (@g.us)  → só envia a mensagem, sem persistir no banco.
 *  - Contato (@s.whatsapp.net) → envia e tenta encontrar/criar a conversa
 *    no tracking para salvar a mensagem. Se não houver lead vinculado ao
 *    número, apenas envia sem persistir.
 */
export const formSendWhatsappNotification = inngest.createFunction(
  { id: "form-send-whatsapp-notification", retries: 2 },
  { event: "form/whatsapp.send" },
  async ({ event }) => {
    const { formName, trackingId, whatsappChats, whatsappMessage, leadData } =
      event.data as FormWhatsappSendEvent["data"];

    if (!whatsappChats?.length) return { skipped: "no_chats" };

    // ── 1. Busca a instância WhatsApp do tracking ──────────────────────────
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { trackingId },
      select: { apiKey: true, baseUrl: true, status: true },
    });

    if (!instance || instance.status !== "CONNECTED") {
      return { skipped: "whatsapp_not_connected" };
    }

    // ── 2. Busca dados completos do lead para resolver variáveis ───────────
    // Só faz a query se houver um lead vinculado e um template customizado.
    let fullLead: {
      name: string;
      email: string | null;
      phone: string | null;
      source: string;
      temperature: string;
      publicToken: string | null;
      createdAt: Date;
      status: { name: string } | null;
      tracking: { name: string } | null;
    } | null = null;

    if (leadData.id) {
      fullLead = await prisma.lead.findUnique({
        where: { id: leadData.id },
        select: {
          name: true,
          email: true,
          phone: true,
          source: true,
          temperature: true,
          publicToken: true,
          createdAt: true,
          status: { select: { name: true } },
          tracking: { select: { name: true } },
        },
      });
    }

    // ── 3. Monta o texto da notificação (template personalizado ou padrão) ─
    const messageText = resolveMessage(whatsappMessage, {
      name: fullLead?.name ?? leadData.name,
      email: fullLead?.email ?? leadData.email,
      phone: fullLead?.phone ?? leadData.phone,
      formName,
      temperature: fullLead?.temperature ?? null,
      source: fullLead?.source ?? null,
      trackingName: fullLead?.tracking?.name ?? null,
      statusName: fullLead?.status?.name ?? null,
      publicToken: fullLead?.publicToken ?? null,
      createdAt: fullLead?.createdAt ?? null,
    });

    // ── 4. Processa cada chat configurado ──────────────────────────────────
    const results: { chatId: string; status: string }[] = [];

    for (const chat of whatsappChats) {
      const isGroup = chat.chatId.endsWith("@g.us");

      try {
        const sendResponse = await sendText(
          instance.apiKey,
          { number: chat.chatId, text: messageText },
          instance.baseUrl,
        );

        // Grupo: envia e segue — sem persistência no banco
        if (isGroup) {
          results.push({ chatId: chat.chatId, status: "sent_group" });
          continue;
        }

        // ── Contato: tenta encontrar/criar conversa e salvar mensagem ──────
        const messageId = sendResponse?.messageid ?? null;

        // Tenta localizar conversa pelo remoteJid
        let existingConversation = await prisma.conversation.findFirst({
          where: { remoteJid: chat.chatId, trackingId },
          select: { id: true },
        });

        if (!existingConversation) {
          // Extrai dígitos do chatId para buscar o lead (ex: 5511999999999)
          const phoneDigits = chat.chatId.replace("@s.whatsapp.net", "");

          const lead = await prisma.lead.findFirst({
            where: {
              trackingId,
              phone: { contains: phoneDigits.slice(-8) },
            },
            select: { id: true },
          });

          if (lead) {
            const newConv = await prisma.conversation.upsert({
              where: {
                leadId_trackingId: { leadId: lead.id, trackingId },
              },
              create: {
                trackingId,
                leadId: lead.id,
                remoteJid: chat.chatId,
              },
              update: {},
            });
            existingConversation = { id: newConv.id };
          }
        }

        // Salva a mensagem se tiver conversa e messageId
        if (existingConversation && messageId) {
          await prisma.message.create({
            data: {
              conversationId: existingConversation.id,
              body: messageText,
              messageId,
              fromMe: true,
              status: MessageStatus.SENT,
            },
          });
        }

        results.push({ chatId: chat.chatId, status: "sent_contact" });
      } catch (err) {
        console.error(
          `[form/whatsapp.send] Erro ao enviar para ${chat.chatId}:`,
          err,
        );
        results.push({ chatId: chat.chatId, status: "error" });
      }
    }

    return { results };
  },
);
