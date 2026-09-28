import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import {
  PAYMENT_REMINDER_CHANNELS,
  PAYMENT_REMINDER_STATUSES,
  REMINDER_CHANNEL_LABELS,
  REMINDER_MAX_RECIPIENTS,
  REMINDER_MESSAGE_MAX_LENGTH,
  REMINDER_STATUS_LABELS,
  parseStoredRecipients,
} from "@/features/payment/schemas/reminders";
import { queryPaymentReminders } from "@/features/payment/server/reminders/list-reminders";
import { findConnectedOrganizationInstance } from "@/features/tracking-chat/lib/providers/send-org-document";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR } from "./payloads";
import { formatReminderDateTime, resolveReminderDateTime } from "./reminder-dates";
import { resolveReminderRecipients } from "./reminder-recipients";
import {
  FINANCE_REMINDER_ACTION_TYPES,
  type CancelReminderProposalPayload,
  type CreateReminderProposalPayload,
} from "./reminder-executors";

// Tools de lembrete com envio do boleto (spec 0017). Propor e cancelar passam
// por confirmação; listar é leitura.

const proposeReminderInput = z.object({
  entryId: z.string().optional().describe("Lançamento a lembrar. O documento mais recente dele vai anexo."),
  attachmentId: z.string().optional().describe("Documento específico a enviar (de list_payment_documents)."),
  remindAtIso: z
    .string()
    .describe("Quando enviar, horário de Brasília: AAAA-MM-DDTHH:mm, 'hoje 14:00' ou 'amanhã' (09:00)."),
  channels: z.array(z.enum(PAYMENT_REMINDER_CHANNELS)).min(1).describe("WHATSAPP e/ou EMAIL."),
  recipients: z
    .array(
      z.object({
        contactId: z.string().optional().describe("ID de PaymentContact, quando conhecido."),
        name: z.string().optional().describe("Nome do contato como o usuário falou; é buscado nos contatos do financeiro."),
        phone: z.string().optional().describe("Telefone com DDD (sobrescreve o do contato)."),
        email: z.string().optional().describe("E-mail (sobrescreve o do contato)."),
      }),
    )
    .min(1)
    .max(REMINDER_MAX_RECIPIENTS),
  message: z.string().max(REMINDER_MESSAGE_MAX_LENGTH).optional().describe("Texto do lembrete. Omita para usar o padrão com descrição, valor e vencimento."),
  notifyCreator: z.boolean().optional().describe("Avisar o usuário quando enviar. Default true."),
});

export function buildFinanceReminderTools(ctx: AgentContext) {
  async function proposeReminder(input: z.infer<typeof proposeReminderInput>) {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { error: access.error };

    const remindAt = resolveReminderDateTime(input.remindAtIso);
    if (!(remindAt instanceof Date)) return remindAt;

    const [entry, attachment] = await Promise.all([
      input.entryId
        ? prisma.paymentEntry.findFirst({
            where: { id: input.entryId, organizationId: ctx.organizationId },
            select: { id: true, description: true, amount: true, dueDate: true, status: true },
          })
        : null,
      input.attachmentId
        ? prisma.paymentAttachment.findFirst({
            where: { id: input.attachmentId, organizationId: ctx.organizationId },
            select: { id: true, fileName: true, entryId: true },
          })
        : null,
    ]);
    if (input.entryId && !entry) return { error: `Lançamento "${input.entryId}" não encontrado nesta organização.` };
    if (input.attachmentId && !attachment) return { error: `Documento "${input.attachmentId}" não encontrado nesta organização.` };
    if (entry && (entry.status === "PAID" || entry.status === "CANCELLED")) {
      return { error: "Esse lançamento já está pago ou cancelado — não faz sentido lembrar." };
    }

    const resolution = await resolveReminderRecipients(ctx.organizationId, input.recipients);
    if (!resolution.isResolved) {
      return { error: resolution.error, candidates: resolution.candidates, needsUserChoice: Boolean(resolution.candidates) };
    }
    const { recipients } = resolution;

    const documentToSend =
      attachment ??
      (entry
        ? await prisma.paymentAttachment.findFirst({
            where: { organizationId: ctx.organizationId, entryId: entry.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, fileName: true, entryId: true },
          })
        : null);

    const warnings: string[] = [];
    let deliverableCount = 0;
    for (const recipient of recipients) {
      if (input.channels.includes("WHATSAPP")) {
        if (recipient.phone) deliverableCount += 1;
        else warnings.push(`${recipient.name} não tem telefone — não recebe no WhatsApp.`);
      }
      if (input.channels.includes("EMAIL")) {
        if (recipient.email) deliverableCount += 1;
        else warnings.push(`${recipient.name} não tem e-mail — não recebe por e-mail.`);
      }
    }
    if (deliverableCount === 0) {
      return { error: "Nenhum destinatário tem telefone ou e-mail para os canais escolhidos. Peça esses dados ao usuário." };
    }
    if (input.channels.includes("WHATSAPP") && !(await findConnectedOrganizationInstance(ctx.organizationId))) {
      warnings.push("Nenhum WhatsApp conectado nesta empresa — o envio por WhatsApp vai falhar (o e-mail segue).");
    }
    if (!documentToSend) warnings.push("Sem documento anexo — só a mensagem será enviada.");

    const lines: AstroConfirmationLine[] = [
      { label: "Quando", value: formatReminderDateTime(remindAt) },
      { label: "Canais", value: input.channels.map((channel) => REMINDER_CHANNEL_LABELS[channel]).join(" + ") },
      {
        label: "Destinatários",
        value: recipients
          .map((recipient) => [recipient.name, recipient.phone, recipient.email].filter(Boolean).join(" · "))
          .join(" | "),
      },
    ];
    if (entry) {
      lines.push({ label: "Lançamento", value: `${entry.description} · ${formatBRL(entry.amount)} · vence ${formatDateBR(entry.dueDate)}` });
    }
    if (documentToSend) lines.push({ label: "Documento", value: documentToSend.fileName });
    if (input.message) lines.push({ label: "Mensagem", value: input.message });
    lines.push({ label: "Custo", value: `até ${deliverableCount}★ (1★ por envio)` });

    const payload: CreateReminderProposalPayload = {
      entryId: entry?.id ?? documentToSend?.entryId ?? undefined,
      attachmentId: documentToSend?.id,
      remindAtIso: remindAt.toISOString(),
      channels: input.channels,
      recipients,
      message: input.message,
      notifyCreator: input.notifyCreator ?? true,
    };

    return createPendingAction({
      ctx,
      actionType: FINANCE_REMINDER_ACTION_TYPES.createReminder,
      payload: payload as unknown as Record<string, unknown>,
      title: "Agendar lembrete com documento",
      lines,
      warnings,
    });
  }

  return {
    propose_payment_reminder: tool({
      description:
        "PROPÕE um lembrete que envia o boleto/documento a contatos por WhatsApp e/ou e-mail numa data e hora. Nada é agendado até o usuário confirmar. Use pra 'manda o boleto pro João amanhã às 9h', 'lembra o cliente X do vencimento'. Destinatário por nome é buscado nos contatos; se vier ambíguo, pergunte qual e chame de novo com contactId.",
      inputSchema: proposeReminderInput,
      execute: proposeReminder,
    }),

    list_payment_reminders: tool({
      description:
        "Lista lembretes financeiros (agendados, enviados, com falha, cancelados), opcionalmente de um lançamento. Use pra 'quais lembretes estão agendados?' ou antes de cancelar.",
      inputSchema: z.object({
        entryId: z.string().optional(),
        status: z.enum(PAYMENT_REMINDER_STATUSES).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input): Promise<(AstroTablePayload & { summary: string }) | { error: string }> => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };

        const reminders = await queryPaymentReminders({
          organizationId: ctx.organizationId,
          entryId: input.entryId,
          status: input.status,
          limit: input.limit ?? 20,
        });
        const scheduledCount = reminders.filter((reminder) => reminder.status === "SCHEDULED").length;

        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "Lembretes financeiros",
          caption: "Lembretes com envio de documento",
          totalCount: reminders.length,
          columns: [
            { key: "remindAt", label: "Quando" },
            { key: "statusLabel", label: "Status", type: "badge" },
            { key: "channels", label: "Canais" },
            { key: "recipients", label: "Destinatários" },
            { key: "entry", label: "Lançamento" },
            { key: "document", label: "Documento" },
          ],
          rows: reminders.map((reminder) => ({
            id: reminder.id,
            remindAt: formatReminderDateTime(reminder.remindAt),
            statusLabel: REMINDER_STATUS_LABELS[reminder.status],
            channels: reminder.channels.map((channel) => REMINDER_CHANNEL_LABELS[channel]).join(" + "),
            recipients: reminder.recipients.map((recipient) => recipient.name).join(", "),
            entry: reminder.entry ? `${reminder.entry.description} · ${formatBRL(reminder.entry.amount)}` : "—",
            document: reminder.attachment?.fileName ?? "—",
          })),
        };
        return { ...table, summary: `${reminders.length} lembrete(s), ${scheduledCount} agendado(s).` };
      },
    }),

    propose_cancel_payment_reminder: tool({
      description:
        "PROPÕE cancelar um lembrete ainda agendado (reminderId de list_payment_reminders). Só cancela depois da confirmação.",
      inputSchema: z.object({ reminderId: z.string() }),
      execute: async ({ reminderId }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const reminder = await prisma.paymentReminder.findFirst({
          where: { id: reminderId, organizationId: ctx.organizationId },
          select: {
            id: true,
            status: true,
            remindAt: true,
            recipients: true,
            entry: { select: { description: true } },
          },
        });
        if (!reminder) return { error: "Lembrete não encontrado nesta organização." };
        if (reminder.status !== "SCHEDULED") {
          return { error: `Esse lembrete está ${REMINDER_STATUS_LABELS[reminder.status].toLowerCase()} e não pode ser cancelado.` };
        }

        const recipientNames = parseStoredRecipients(reminder.recipients)
          .map((recipient) => recipient.name)
          .join(", ");

        const payload: CancelReminderProposalPayload = { reminderId: reminder.id };
        const lines: AstroConfirmationLine[] = [
          { label: "Quando", value: formatReminderDateTime(reminder.remindAt) },
        ];
        if (reminder.entry) lines.push({ label: "Lançamento", value: reminder.entry.description });
        if (recipientNames) lines.push({ label: "Destinatários", value: recipientNames });

        return createPendingAction({
          ctx,
          actionType: FINANCE_REMINDER_ACTION_TYPES.cancelReminder,
          payload: payload as unknown as Record<string, unknown>,
          title: "Cancelar lembrete",
          lines,
        });
      },
    }),
  };
}
