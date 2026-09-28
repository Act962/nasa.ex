import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { HIGH_CONFIDENCE, MIN_SUGGESTION } from "@/features/payment/lib/reconciliation/score-match";
import { listStatementTransactionsRecord } from "@/features/payment/server/statements/list-transactions";
import { loadReconciliationCandidate } from "@/features/payment/server/statements/reconcile-transaction";
import { assertPaymentToolAccess } from "./access";
import { ENTRY_TYPE_LABELS, formatBRL, formatDateBR } from "./payloads";
import {
  STATEMENT_ACTION_TYPES,
  type ReconcileBatchProposalPayload,
  type ReconcileProposalPayload,
} from "./statement-executors";

// Fila de conciliação e propostas de casar transação com lançamento
// (spec 0016, RF-4/RF-5).

const BATCH_SCAN_SIZE = 100;
const MAX_BATCH_PREVIEW_LINES = 12;
const MEMO_PREVIEW_LENGTH = 40;

const DIRECTION_LABELS: Record<"CREDIT" | "DEBIT", string> = { CREDIT: "Entrada", DEBIT: "Saída" };

function truncateMemo(memo: string): string {
  return memo.length > MEMO_PREVIEW_LENGTH ? `${memo.slice(0, MEMO_PREVIEW_LENGTH - 1)}…` : memo;
}

export function buildStatementReconciliationTools(ctx: AgentContext) {
  return {
    list_unreconciled_transactions: tool({
      description:
        "TABELA das transações do extrato aguardando conciliação, cada uma com o lançamento sugerido (score 0-100, confiança, se é ambígua). Use pra 'o que falta conciliar', 'movimentações sem lançamento', 'concilia o extrato'. Para aceitar sugestões de alta confiança de uma vez use propose_reconciliation_batch.",
      inputSchema: z.object({
        accountId: z.string().optional().describe("PaymentBankAccount. Sem isso, todas as contas."),
        direction: z.enum(["CREDIT", "DEBIT"]).optional().describe("CREDIT = entradas, DEBIT = saídas."),
        search: z.string().optional().describe("Busca no histórico e na contraparte."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };

        const listing = await listStatementTransactionsRecord({
          organizationId: ctx.organizationId,
          accountId: input.accountId,
          status: "PENDING",
          direction: input.direction,
          search: input.search,
          withSuggestions: true,
          page: 1,
          pageSize: input.limit ?? 25,
        });

        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "Transações a conciliar",
          caption: `${listing.total} pendente(s) · entradas ${formatBRL(listing.totals.creditCents)} · saídas ${formatBRL(listing.totals.debitCents)}`,
          totalCount: listing.total,
          columns: [
            { key: "postedDate", label: "Data", type: "date" },
            { key: "memo", label: "Histórico" },
            { key: "amount", label: "Valor", type: "currency" },
            { key: "directionLabel", label: "Tipo", type: "badge" },
            { key: "suggestion", label: "Lançamento sugerido" },
            { key: "score", label: "Score", type: "number" },
            { key: "sourceLabel", label: "Origem", type: "badge" },
          ],
          rows: listing.transactions.map((transaction) => ({
            id: transaction.id,
            postedDate: transaction.postedDate.toISOString(),
            memo: transaction.counterpartyName ? `${transaction.memo} · ${transaction.counterpartyName}` : transaction.memo,
            amount: transaction.amountCents,
            directionLabel: DIRECTION_LABELS[transaction.direction],
            suggestion: transaction.suggestion
              ? `${transaction.suggestion.entry.description}${transaction.suggestion.isAmbiguous ? " (ambígua)" : ""}`
              : "—",
            score: transaction.suggestion?.score ?? 0,
            sourceLabel: transaction.source === "PDF_UPLOAD" ? "PDF" : "OFX",
          })),
        };

        return {
          ...table,
          summary: `${listing.total} transação(ões) a conciliar; ${listing.transactions.filter((transaction) => transaction.suggestion).length} das exibidas têm sugestão.`,
          transactions: listing.transactions.map((transaction) => ({
            transactionId: transaction.id,
            postedDate: formatDateBR(transaction.postedDate),
            direction: transaction.direction,
            amountCents: transaction.amountCents,
            memo: transaction.memo,
            counterpartyName: transaction.counterpartyName,
            suggestion: transaction.suggestion
              ? {
                  entryId: transaction.suggestion.entryId,
                  description: transaction.suggestion.entry.description,
                  score: transaction.suggestion.score,
                  confidence: transaction.suggestion.confidence,
                  isAmbiguous: transaction.suggestion.isAmbiguous,
                }
              : null,
          })),
        };
      },
    }),

    propose_reconciliation: tool({
      description:
        "PROPÕE conciliar UMA transação do extrato com UM lançamento em aberto (dá a baixa no lançamento com a data e o valor da transação). Devolve card de confirmação.",
      inputSchema: z.object({
        transactionId: z.string().describe("ID da transação (list_unreconciled_transactions)."),
        entryId: z.string().describe("ID do PaymentEntry em aberto."),
      }),
      execute: async ({ transactionId, entryId }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const candidate = await loadReconciliationCandidate({
          organizationId: ctx.organizationId,
          transactionId,
          entryId,
        });
        if (!candidate.ok) return { error: candidate.message };
        const { transaction, entry } = candidate;

        const remainingCents = entry.amount - entry.paidAmount;
        const settlesEntry = transaction.amountCents >= remainingCents;
        const lines: AstroConfirmationLine[] = [
          {
            label: "Transação",
            value: `${formatDateBR(transaction.postedDate)} · ${DIRECTION_LABELS[transaction.direction]} · ${truncateMemo(transaction.memo)}`,
          },
          { label: "Valor", value: formatBRL(transaction.amountCents) },
          {
            label: "Lançamento",
            value: `${entry.description}${entry.contact ? ` · ${entry.contact.name}` : ""} · vence ${formatDateBR(entry.dueDate)}`,
          },
          { label: "Saldo em aberto", value: formatBRL(remainingCents) },
          {
            label: "Resultado",
            value: settlesEntry ? "Lançamento quitado" : `Baixa parcial — restam ${formatBRL(remainingCents - transaction.amountCents)}`,
          },
        ];

        const warnings: string[] = [];
        const isDirectionMismatch =
          (transaction.direction === "CREDIT" && entry.type === "PAYABLE") ||
          (transaction.direction === "DEBIT" && entry.type === "RECEIVABLE");
        if (isDirectionMismatch) {
          warnings.push(
            `A transação é uma ${DIRECTION_LABELS[transaction.direction].toLowerCase()}, mas o lançamento é ${ENTRY_TYPE_LABELS[entry.type]?.toLowerCase() ?? entry.type} — confira.`,
          );
        }

        const payload: ReconcileProposalPayload = { transactionId: transaction.id, entryId: entry.id };
        return createPendingAction({
          ctx,
          actionType: STATEMENT_ACTION_TYPES.reconcile,
          payload: payload as unknown as Record<string, unknown>,
          title: "Conciliar transação",
          lines,
          warnings,
        });
      },
    }),

    propose_reconciliation_batch: tool({
      description: `PROPÕE conciliar DE UMA VEZ as transações pendentes cuja sugestão tem score ≥ minScore (default ${HIGH_CONFIDENCE}, mínimo ${MIN_SUGGESTION}). Sugestões ambíguas ficam de fora. Devolve card de confirmação com a lista. Use pra 'concilia o que for certeiro', 'aceita as sugestões'.`,
      inputSchema: z.object({
        accountId: z.string().optional(),
        minScore: z.number().int().min(MIN_SUGGESTION).max(100).optional(),
      }),
      execute: async ({ accountId, minScore }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const threshold = minScore ?? HIGH_CONFIDENCE;
        const listing = await listStatementTransactionsRecord({
          organizationId: ctx.organizationId,
          accountId,
          status: "PENDING",
          withSuggestions: true,
          page: 1,
          pageSize: BATCH_SCAN_SIZE,
        });

        let ambiguousCount = 0;
        let belowThresholdCount = 0;
        const selected = listing.transactions.filter((transaction) => {
          const suggestion = transaction.suggestion;
          if (!suggestion) return false;
          if (suggestion.score < threshold) {
            belowThresholdCount++;
            return false;
          }
          if (suggestion.isAmbiguous) {
            ambiguousCount++;
            return false;
          }
          return transaction.amountCents <= suggestion.entry.amount - suggestion.entry.paidAmount;
        });

        if (selected.length === 0) {
          return {
            proposed: 0,
            summary: `Nenhuma sugestão com score ≥ ${threshold} pronta pra conciliar em lote (${ambiguousCount} ambígua(s), ${belowThresholdCount} abaixo do corte). Use list_unreconciled_transactions e concilie uma a uma.`,
          };
        }

        const totalCents = selected.reduce((sum, transaction) => sum + transaction.amountCents, 0);
        const lines: AstroConfirmationLine[] = [
          { label: "Conciliações", value: `${selected.length} (score ≥ ${threshold})` },
          { label: "Total", value: formatBRL(totalCents) },
        ];
        for (const transaction of selected.slice(0, MAX_BATCH_PREVIEW_LINES)) {
          lines.push({
            label: `${formatDateBR(transaction.postedDate)} · ${formatBRL(transaction.amountCents)}`,
            value: `${truncateMemo(transaction.memo)} → ${transaction.suggestion?.entry.description ?? "—"} (${transaction.suggestion?.score ?? 0})`,
          });
        }
        if (selected.length > MAX_BATCH_PREVIEW_LINES) {
          lines.push({ label: "…", value: `e mais ${selected.length - MAX_BATCH_PREVIEW_LINES}` });
        }

        const warnings: string[] = [];
        if (ambiguousCount > 0) warnings.push(`${ambiguousCount} sugestão(ões) ambígua(s) ficaram de fora — resolva uma a uma.`);
        if (listing.total > BATCH_SCAN_SIZE) {
          warnings.push(`Analisei as ${BATCH_SCAN_SIZE} transações mais recentes de ${listing.total}; rode de novo depois pra ver o restante.`);
        }

        const payload: ReconcileBatchProposalPayload = {
          minScore: threshold,
          items: selected.map((transaction) => ({
            transactionId: transaction.id,
            entryId: transaction.suggestion?.entryId ?? "",
            score: transaction.suggestion?.score ?? 0,
          })),
        };
        return createPendingAction({
          ctx,
          actionType: STATEMENT_ACTION_TYPES.reconcileBatch,
          payload: payload as unknown as Record<string, unknown>,
          title: "Conciliar em lote",
          lines,
          warnings,
        });
      },
    }),
  };
}
