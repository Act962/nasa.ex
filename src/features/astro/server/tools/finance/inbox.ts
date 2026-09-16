import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import {
  listInboxItems,
  loadInboxOverview,
  queueInboxSync,
} from "@/features/payment/server/inbox/inbox-service";
import type { InboxExtractionSummary } from "@/features/payment/server/inbox/ingest-inbox-attachment";
import prisma from "@/lib/prisma";
import { assertPaymentToolAccess } from "./access";
import { INBOX_ACTION_TYPES, type IgnoreInboxItemProposalPayload } from "./inbox-executors";
import { formatBRL, formatDateBR } from "./payloads";

// Tools da caixa de entrada Gmail do financeiro (spec 0018). Lançar um
// documento encontrado reusa read_financial_document (cache, sem nova
// cobrança) + propose_payment_entry com o attachmentId.

const INBOX_STATUS_LABELS: Record<string, string> = {
  NEW: "Na fila",
  PROPOSED: "Pronto pra lançar",
  ACCEPTED: "Lançado",
  IGNORED: "Ignorado",
  FAILED: "Falhou",
};

function readSummary(value: unknown): InboxExtractionSummary | null {
  if (typeof value !== "object" || value === null) return null;
  return "documentType" in value ? (value as InboxExtractionSummary) : null;
}

export function buildFinanceInboxTools(ctx: AgentContext) {
  return {
    list_inbox_documents: tool({
      description:
        "TABELA dos documentos financeiros encontrados na caixa Gmail conectada à empresa (boletos/NFs em anexos de e-mail): assunto, remetente, valor, vencimento e status. Use pra 'o que chegou no e-mail?', 'boletos do e-mail', 'lança os boletos do e-mail'. Pra lançar um item PROPOSED: read_financial_document({ attachmentId }) — não cobra de novo — e depois propose_payment_entry com o mesmo attachmentId.",
      inputSchema: z.object({
        status: z
          .enum(["NEW", "PROPOSED", "ACCEPTED", "IGNORED", "FAILED"])
          .optional()
          .describe("Default: PROPOSED (prontos pra lançar)."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };

        const status = input.status ?? "PROPOSED";
        const [overview, { items, total }] = await Promise.all([
          loadInboxOverview(ctx.organizationId),
          listInboxItems({
            organizationId: ctx.organizationId,
            statuses: [status],
            page: 1,
            perPage: input.limit ?? 20,
          }),
        ]);

        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "Caixa de entrada (Gmail)",
          caption: `${total} item(ns) · ${INBOX_STATUS_LABELS[status]}${overview.integration.accountEmail ? ` · caixa ${overview.integration.accountEmail}` : ""}`,
          totalCount: total,
          columns: [
            { key: "subject", label: "Assunto" },
            { key: "from", label: "Remetente" },
            { key: "amount", label: "Valor" },
            { key: "dueDate", label: "Vencimento" },
            { key: "statusLabel", label: "Status", type: "badge" },
          ],
          rows: items.map((item) => {
            const summary = readSummary(item.extraction);
            return {
              id: item.id,
              subject: item.subject,
              from: item.fromName ?? item.fromEmail,
              amount: summary?.amountCents != null ? formatBRL(summary.amountCents) : "—",
              dueDate: summary?.dueDate ? formatDateBR(summary.dueDate) : "—",
              statusLabel: INBOX_STATUS_LABELS[item.status] ?? item.status,
            };
          }),
        };

        return {
          ...table,
          inboxEnabled: overview.config.isEnabled,
          lastSyncAt: overview.config.lastSyncAt?.toISOString() ?? null,
          lastError: overview.config.lastError,
          items: items.map((item) => ({
            itemId: item.id,
            attachmentId: item.attachment?.id ?? null,
            fileName: item.attachment?.fileName ?? null,
            status: item.status,
            extraction: readSummary(item.extraction),
            errorMessage: item.errorMessage,
            entryId: item.entry?.id ?? null,
          })),
          summary:
            total === 0
              ? `Nenhum documento com status ${INBOX_STATUS_LABELS[status]} na caixa de entrada.`
              : `${total} documento(s) com status ${INBOX_STATUS_LABELS[status]}.`,
        };
      },
    }),

    sync_gmail_inbox_now: tool({
      description:
        "Dispara agora a leitura da caixa Gmail conectada (em segundo plano, leva alguns minutos). Não grava nada no financeiro — só encontra anexos e lê os documentos (5★ por documento novo). Use quando o usuário pedir 'verifica meu e-mail', 'puxa os boletos do e-mail agora'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertPaymentToolAccess(ctx, "entries", "create");
        if (!access.ok) return { error: access.error };
        const result = await queueInboxSync({
          organizationId: ctx.organizationId,
          triggeredByUserId: ctx.userId,
        });
        if (!result.ok) return { error: result.message };
        return {
          queued: true,
          summary:
            "Leitura do e-mail iniciada. Em alguns minutos os documentos aparecem em list_inbox_documents e você recebe uma notificação.",
        };
      },
    }),

    propose_ignore_inbox_item: tool({
      description:
        "PROPÕE marcar um item da caixa de entrada Gmail como ignorado (não é conta da empresa, é duplicado, spam). Nada muda até o usuário confirmar. O arquivo continua em Documentos.",
      inputSchema: z.object({
        itemId: z.string().describe("itemId vindo de list_inbox_documents."),
      }),
      execute: async ({ itemId }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const item = await prisma.paymentInboxItem.findFirst({
          where: { id: itemId, organizationId: ctx.organizationId },
          select: { id: true, subject: true, fromEmail: true, status: true, receivedAt: true },
        });
        if (!item) return { error: `Item "${itemId}" não encontrado na caixa de entrada desta empresa.` };
        if (item.status === "ACCEPTED") return { error: "Este documento já virou lançamento." };

        const payload: IgnoreInboxItemProposalPayload = { itemId: item.id };
        return createPendingAction({
          ctx,
          actionType: INBOX_ACTION_TYPES.ignoreItem,
          payload: payload as unknown as Record<string, unknown>,
          title: "Ignorar documento do e-mail",
          lines: [
            { label: "Assunto", value: item.subject },
            { label: "Remetente", value: item.fromEmail },
            { label: "Recebido em", value: formatDateBR(item.receivedAt) },
            { label: "Status atual", value: INBOX_STATUS_LABELS[item.status] ?? item.status },
          ],
        });
      },
    }),
  };
}
