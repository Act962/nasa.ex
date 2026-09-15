import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { loadPendingStatementTransaction } from "@/features/payment/server/statements/create-entry-from-transaction";
import { loadIgnorableStatementTransaction } from "@/features/payment/server/statements/ignore-transaction";
import { loadMatchedStatementTransaction } from "@/features/payment/server/statements/unmatch-transaction";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR } from "./payloads";
import {
  STATEMENT_ACTION_TYPES,
  type CreateEntryFromTransactionProposalPayload,
  type IgnoreTransactionProposalPayload,
  type UnmatchTransactionProposalPayload,
} from "./statement-executors";

// Resolver uma transação sem casar com lançamento existente: virar lançamento
// novo, ignorar, ou desfazer uma conciliação (spec 0016, RF-6).

function describeTransaction(transaction: {
  postedDate: Date;
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  memo: string;
}): AstroConfirmationLine[] {
  return [
    {
      label: "Transação",
      value: `${formatDateBR(transaction.postedDate)} · ${transaction.direction === "CREDIT" ? "Entrada" : "Saída"} · ${transaction.memo}`,
    },
    { label: "Valor", value: formatBRL(transaction.amountCents) },
  ];
}

export function buildStatementTransactionTools(ctx: AgentContext) {
  return {
    propose_entry_from_transaction: tool({
      description:
        "PROPÕE criar um lançamento NOVO a partir de uma transação do extrato que não tem lançamento correspondente (tarifa, compra no débito, recebimento avulso). O lançamento nasce quitado na data da transação e já conciliado. Devolve card de confirmação.",
      inputSchema: z.object({
        transactionId: z.string(),
        description: z.string().trim().min(1).max(120),
        categoryId: z.string().optional().describe("PaymentCategory (list_payment_categories)."),
        contactId: z.string().optional().describe("PaymentContact (list_payment_contacts)."),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "create");
        if (!access.ok) return { error: access.error };

        const loaded = await loadPendingStatementTransaction({
          organizationId: ctx.organizationId,
          transactionId: input.transactionId,
        });
        if (!loaded.ok) return { error: loaded.message };
        const { transaction } = loaded;

        const [category, contact, account] = await Promise.all([
          input.categoryId
            ? prisma.paymentCategory.findFirst({
                where: { id: input.categoryId, organizationId: ctx.organizationId },
                select: { name: true },
              })
            : Promise.resolve(null),
          input.contactId
            ? prisma.paymentContact.findFirst({
                where: { id: input.contactId, organizationId: ctx.organizationId },
                select: { name: true },
              })
            : Promise.resolve(null),
          prisma.paymentBankAccount.findFirst({
            where: { id: transaction.accountId, organizationId: ctx.organizationId },
            select: { name: true },
          }),
        ]);
        if (input.categoryId && !category) {
          return { error: `categoryId "${input.categoryId}" inválido. Use list_payment_categories.` };
        }
        if (input.contactId && !contact) {
          return { error: `contactId "${input.contactId}" inválido. Use list_payment_contacts.` };
        }

        const lines: AstroConfirmationLine[] = [
          ...describeTransaction(transaction),
          { label: "Novo lançamento", value: input.description },
          { label: "Tipo", value: transaction.direction === "CREDIT" ? "Receita (já recebida)" : "Despesa (já paga)" },
        ];
        if (category) lines.push({ label: "Categoria", value: category.name });
        if (contact) lines.push({ label: "Contato", value: contact.name });
        if (account) lines.push({ label: "Conta", value: account.name });

        const payload: CreateEntryFromTransactionProposalPayload = {
          transactionId: transaction.id,
          description: input.description,
          categoryId: input.categoryId,
          contactId: input.contactId,
        };
        return createPendingAction({
          ctx,
          actionType: STATEMENT_ACTION_TYPES.createEntry,
          payload: payload as unknown as Record<string, unknown>,
          title: "Criar lançamento a partir do extrato",
          lines,
        });
      },
    }),

    propose_ignore_transaction: tool({
      description:
        "PROPÕE ignorar uma transação do extrato (sai da fila de conciliação — ex.: transferência entre contas próprias, aplicação/resgate) ou, com undo=true, devolvê-la para a fila. Devolve card de confirmação.",
      inputSchema: z.object({
        transactionId: z.string(),
        reason: z.string().max(200).optional().describe("Motivo curto, aparece na aba Ignoradas."),
        undo: z.boolean().optional().describe("true = restaurar uma transação ignorada."),
      }),
      execute: async ({ transactionId, reason, undo }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const loaded = await loadIgnorableStatementTransaction({ organizationId: ctx.organizationId, transactionId });
        if (!loaded.ok) return { error: loaded.message };
        const { transaction } = loaded;
        const isUndo = undo ?? false;
        if (isUndo && transaction.status !== "IGNORED") return { error: "Esta transação não está ignorada." };
        if (!isUndo && transaction.status === "IGNORED") return { error: "Esta transação já está ignorada." };

        const lines = describeTransaction(transaction);
        if (!isUndo && reason) lines.push({ label: "Motivo", value: reason });
        if (isUndo && transaction.ignoredReason) {
          lines.push({ label: "Motivo anterior", value: transaction.ignoredReason });
        }

        const payload: IgnoreTransactionProposalPayload = { transactionId: transaction.id, reason, undo: isUndo };
        return createPendingAction({
          ctx,
          actionType: STATEMENT_ACTION_TYPES.ignore,
          payload: payload as unknown as Record<string, unknown>,
          title: isUndo ? "Restaurar transação" : "Ignorar transação",
          lines,
        });
      },
    }),

    propose_unmatch_transaction: tool({
      description:
        "PROPÕE desfazer a conciliação de uma transação: estorna a baixa do lançamento e devolve a transação para a fila. Devolve card de confirmação.",
      inputSchema: z.object({ transactionId: z.string() }),
      execute: async ({ transactionId }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const loaded = await loadMatchedStatementTransaction({ organizationId: ctx.organizationId, transactionId });
        if (!loaded.ok) return { error: loaded.message };
        const { transaction } = loaded;

        const lines = describeTransaction(transaction);
        if (transaction.matchedEntry) lines.push({ label: "Lançamento", value: transaction.matchedEntry.description });

        const payload: UnmatchTransactionProposalPayload = { transactionId: transaction.id };
        return createPendingAction({
          ctx,
          actionType: STATEMENT_ACTION_TYPES.unmatch,
          payload: payload as unknown as Record<string, unknown>,
          title: "Desfazer conciliação",
          lines,
          warnings: [`A baixa de ${formatBRL(transaction.amountCents)} no lançamento será estornada.`],
        });
      },
    }),
  };
}
