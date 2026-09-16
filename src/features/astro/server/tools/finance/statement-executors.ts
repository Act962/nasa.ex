import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import {
  registerProposalExecutor,
  type ProposalExecutionResult,
} from "@/features/astro/server/tools/_shared/proposals/types";
import type { StatementActor } from "@/features/payment/server/statements/service-result";
import { importStatementFromAttachment } from "@/features/payment/server/statements/import-statement";
import { reconcileStatementTransactionRecord } from "@/features/payment/server/statements/reconcile-transaction";
import { createEntryFromStatementTransaction } from "@/features/payment/server/statements/create-entry-from-transaction";
import { ignoreStatementTransactionRecord } from "@/features/payment/server/statements/ignore-transaction";
import { unmatchStatementTransactionRecord } from "@/features/payment/server/statements/unmatch-transaction";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR } from "./payloads";

// Executores das propostas de extrato e conciliação (spec 0016). Rodam só
// depois do "sim" e reusam os serviços da aba Conciliação.

export const STATEMENT_ACTION_TYPES = {
  importStatement: "payment.statement.import",
  reconcile: "payment.tx.reconcile",
  reconcileBatch: "payment.tx.reconcile_batch",
  createEntry: "payment.tx.create_entry",
  ignore: "payment.tx.ignore",
  unmatch: "payment.tx.unmatch",
} as const;

export const RECONCILIATION_LINK = { label: "Abrir conciliação", href: "/payment?tab=reconciliation" };

export interface StatementImportProposalPayload {
  attachmentId: string;
  accountId: string;
  kind: "OFX" | "PDF";
  fileName: string;
}

export interface ReconcileProposalPayload {
  transactionId: string;
  entryId: string;
}

export interface ReconcileBatchProposalPayload {
  minScore: number;
  items: Array<{ transactionId: string; entryId: string; score: number }>;
}

export interface CreateEntryFromTransactionProposalPayload {
  transactionId: string;
  description: string;
  categoryId?: string;
  contactId?: string;
}

export interface IgnoreTransactionProposalPayload {
  transactionId: string;
  reason?: string;
  undo: boolean;
}

export interface UnmatchTransactionProposalPayload {
  transactionId: string;
}

const MAX_BATCH_FAILURE_LINES = 5;

async function loadStatementActor(ctx: AgentContext): Promise<StatementActor> {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, email: true },
  });
  return { id: ctx.userId, name: user?.name ?? "", email: user?.email ?? "" };
}

registerProposalExecutor<StatementImportProposalPayload>(
  STATEMENT_ACTION_TYPES.importStatement,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "create");
    if (!access.ok) return { ok: false, summary: access.error };

    const result = await importStatementFromAttachment({
      organizationId: ctx.organizationId,
      accountId: payload.accountId,
      attachmentId: payload.attachmentId,
      createdById: ctx.userId,
      kind: payload.kind,
      starsAppSlug: "astro",
    });
    if (!result.ok) return { ok: false, summary: result.message };

    const lines: AstroConfirmationLine[] = [
      { label: "Conta", value: result.accountName },
      { label: "Transações novas", value: String(result.imported) },
      { label: "Já existiam", value: String(result.duplicated) },
    ];
    if (result.periodStart && result.periodEnd) {
      lines.push({ label: "Período", value: `${formatDateBR(result.periodStart)} a ${formatDateBR(result.periodEnd)}` });
    }
    if (result.starsCharged > 0) lines.push({ label: "Stars", value: `${result.starsCharged}★` });
    if (result.renamedTo) lines.push({ label: "Documento salvo como", value: result.renamedTo });
    const relevantWarnings = result.warnings.filter((warning) => warning.severity !== "info");
    if (relevantWarnings.length > 0) {
      lines.push({ label: "Avisos", value: relevantWarnings.map((warning) => warning.message).join(" · ") });
    }

    return {
      ok: true,
      summary:
        result.imported > 0
          ? `${result.imported} transação(ões) nova(s) importada(s) em "${result.accountName}". Posso sugerir as conciliações.`
          : "Nenhuma transação nova — este extrato já estava importado.",
      lines,
      links: [RECONCILIATION_LINK],
      data: {
        importId: result.importId,
        imported: result.imported,
        duplicated: result.duplicated,
        starsCharged: result.starsCharged,
        renamedTo: result.renamedTo,
      },
    };
  },
);

registerProposalExecutor<ReconcileProposalPayload>(
  STATEMENT_ACTION_TYPES.reconcile,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    const result = await reconcileStatementTransactionRecord({
      organizationId: ctx.organizationId,
      actor: await loadStatementActor(ctx),
      transactionId: payload.transactionId,
      entryId: payload.entryId,
    });
    if (!result.ok) return { ok: false, summary: result.message };

    return {
      ok: true,
      summary:
        result.entryStatus === "PAID"
          ? `Conciliado: "${result.entryDescription}" quitado com ${formatBRL(result.amountCents)} do extrato.`
          : `Conciliado: baixa parcial de ${formatBRL(result.amountCents)} em "${result.entryDescription}".`,
      links: [RECONCILIATION_LINK],
      data: { entryId: result.entryId, entryStatus: result.entryStatus },
    };
  },
);

registerProposalExecutor<ReconcileBatchProposalPayload>(
  STATEMENT_ACTION_TYPES.reconcileBatch,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    const actor = await loadStatementActor(ctx);
    let reconciledCount = 0;
    let reconciledCents = 0;
    const failures: string[] = [];

    // Um item que falhou (já conciliado por outra via, saldo mudou) não
    // derruba os demais — cada conciliação é independente.
    for (const item of payload.items) {
      try {
        const result = await reconcileStatementTransactionRecord({
          organizationId: ctx.organizationId,
          actor,
          transactionId: item.transactionId,
          entryId: item.entryId,
          matchMethod: "SUGGESTION",
        });
        if (result.ok) {
          reconciledCount++;
          reconciledCents += result.amountCents;
        } else {
          failures.push(result.message);
        }
      } catch (error) {
        console.error("[astro/finance] batch reconcile item failed:", error);
        failures.push("Erro inesperado ao conciliar uma transação");
      }
    }

    const lines: AstroConfirmationLine[] = [
      { label: "Conciliadas", value: `${reconciledCount} de ${payload.items.length}` },
      { label: "Total baixado", value: formatBRL(reconciledCents) },
    ];
    failures.slice(0, MAX_BATCH_FAILURE_LINES).forEach((message, index) => {
      lines.push({ label: `Falha ${index + 1}`, value: message });
    });

    return {
      ok: reconciledCount > 0,
      summary:
        failures.length === 0
          ? `${reconciledCount} transação(ões) conciliada(s).`
          : `${reconciledCount} conciliada(s), ${failures.length} não puderam ser conciliadas.`,
      lines,
      links: [RECONCILIATION_LINK],
      data: { reconciledCount, failedCount: failures.length },
    };
  },
);

registerProposalExecutor<CreateEntryFromTransactionProposalPayload>(
  STATEMENT_ACTION_TYPES.createEntry,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "create");
    if (!access.ok) return { ok: false, summary: access.error };

    const result = await createEntryFromStatementTransaction({
      organizationId: ctx.organizationId,
      actor: await loadStatementActor(ctx),
      transactionId: payload.transactionId,
      description: payload.description,
      categoryId: payload.categoryId,
      contactId: payload.contactId,
    });
    if (!result.ok) return { ok: false, summary: result.message };

    return {
      ok: true,
      summary: `Lançamento "${payload.description}" criado já quitado e conciliado com o extrato.`,
      links: [RECONCILIATION_LINK],
      data: { entryId: result.entryId },
    };
  },
);

registerProposalExecutor<IgnoreTransactionProposalPayload>(
  STATEMENT_ACTION_TYPES.ignore,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    const result = await ignoreStatementTransactionRecord({
      organizationId: ctx.organizationId,
      transactionId: payload.transactionId,
      reason: payload.reason,
      undo: payload.undo,
    });
    if (!result.ok) return { ok: false, summary: result.message };

    return {
      ok: true,
      summary: payload.undo ? "Transação devolvida para a fila de conciliação." : "Transação ignorada.",
      links: [RECONCILIATION_LINK],
      data: { transactionId: payload.transactionId },
    };
  },
);

registerProposalExecutor<UnmatchTransactionProposalPayload>(
  STATEMENT_ACTION_TYPES.unmatch,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    const result = await unmatchStatementTransactionRecord({
      organizationId: ctx.organizationId,
      transactionId: payload.transactionId,
    });
    if (!result.ok) return { ok: false, summary: result.message };

    return {
      ok: true,
      summary: "Conciliação desfeita: a baixa do lançamento foi estornada e a transação voltou para a fila.",
      links: [RECONCILIATION_LINK],
      data: { entryId: result.entryId },
    };
  },
);
