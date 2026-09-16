import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import {
  findPreviousStatementImport,
  inspectStatementFromAttachment,
  type StatementInspection,
} from "@/features/payment/server/statements/inspect-statement";
import { PDF_STATEMENT_STARS_ACTION } from "@/features/payment/server/statements/import-statement";
import { describeStatementAccountMismatch } from "@/features/payment/server/statements/suggest-statement-account";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR } from "./payloads";
import { STATEMENT_ACTION_TYPES, type StatementImportProposalPayload } from "./statement-executors";

// Extrato bancário anexado (OFX ou PDF) → inspeção → proposta de importação
// (spec 0016, RF-1/RF-3). A leitura por IA do PDF é grátis; cobra ao confirmar.

const MATCH_REASON_LABELS: Record<StatementInspection["matchReason"], string> = {
  EXACT_ACCOUNT: "já recebeu extratos desta conta bancária",
  BANK_CODE: "única conta cadastrada neste banco",
  ONLY_ACCOUNT: "única conta cadastrada",
  NONE: "conta não identificada",
};

async function loadPdfImportStarsCost(): Promise<number> {
  const rule = await prisma.appStarCost.findUnique({
    where: { appSlug: PDF_STATEMENT_STARS_ACTION },
    select: { monthlyCost: true },
  });
  return rule?.monthlyCost ?? 0;
}

function formatPeriod(inspection: StatementInspection): string {
  if (!inspection.periodStart || !inspection.periodEnd) return "não informado";
  return `${formatDateBR(inspection.periodStart)} a ${formatDateBR(inspection.periodEnd)}`;
}

function relevantWarningMessages(inspection: StatementInspection): string[] {
  return inspection.warnings.filter((warning) => warning.severity !== "info").map((warning) => warning.message);
}

export function buildStatementImportTools(ctx: AgentContext) {
  async function loadActiveAccounts() {
    return prisma.paymentBankAccount.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      select: { id: true, name: true, bankName: true, bankCode: true, ofxAccountId: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  return {
    inspect_bank_statement: tool({
      description:
        "LÊ um extrato bancário anexado (OFX ou PDF) SEM gravar nada: banco, conta, período, nº de transações, total de entradas e saídas, conta cadastrada sugerida e avisos. Chame quando o usuário anexar um extrato ou pedir 'importa/concilia esse extrato'. PDF é lido por IA (grátis aqui; a importação cobra Stars). Depois, chame propose_statement_import.",
      inputSchema: z.object({
        attachmentId: z.string().describe("ID do anexo (vem em [ARQUIVOS ANEXADOS] ou em list_payment_documents)."),
      }),
      execute: async ({ attachmentId }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };

        const result = await inspectStatementFromAttachment({
          organizationId: ctx.organizationId,
          attachmentId,
          userId: ctx.userId,
        });
        if (!result.ok) return { error: result.message, reason: result.reason };
        const { inspection } = result;

        const [accounts, alreadyImportedAt, pdfStarsCost] = await Promise.all([
          loadActiveAccounts(),
          inspection.suggestedAccountId
            ? findPreviousStatementImport({
                organizationId: ctx.organizationId,
                accountId: inspection.suggestedAccountId,
                fileHash: inspection.fileHash,
              })
            : Promise.resolve(null),
          inspection.kind === "PDF" ? loadPdfImportStarsCost() : Promise.resolve(0),
        ]);
        const suggestedAccount = accounts.find((account) => account.id === inspection.suggestedAccountId) ?? null;

        return {
          attachmentId,
          format: inspection.kind,
          bankName: inspection.bankName,
          bankCode: inspection.bankId,
          statementAccountId: inspection.statementAccountId,
          period: formatPeriod(inspection),
          transactionCount: inspection.transactionCount,
          creditsFormatted: formatBRL(inspection.creditCents),
          debitsFormatted: formatBRL(inspection.debitCents),
          suggestedAccount: suggestedAccount ? { id: suggestedAccount.id, name: suggestedAccount.name } : null,
          matchReason: MATCH_REASON_LABELS[inspection.matchReason],
          accounts: suggestedAccount ? undefined : accounts.map((account) => ({ id: account.id, name: account.name, bankName: account.bankName })),
          alreadyImportedAt: alreadyImportedAt ? formatDateBR(alreadyImportedAt) : null,
          starsCostOnImport: inspection.kind === "PDF" ? pdfStarsCost : 0,
          warnings: relevantWarningMessages(inspection),
          suggestedNextStep: suggestedAccount
            ? `Chame propose_statement_import com attachmentId=${attachmentId} e accountId=${suggestedAccount.id}.`
            : "Pergunte ao usuário em qual conta importar (liste `accounts`) e então chame propose_statement_import.",
        };
      },
    }),

    propose_statement_import: tool({
      description:
        "PROPÕE importar um extrato anexado (OFX ou PDF) numa conta bancária. Devolve card de confirmação com banco, conta, período, nº de transações e custo em Stars (PDF). Sem accountId usa a conta sugerida pela inspeção. Recusa se o extrato for de outra conta.",
      inputSchema: z.object({
        attachmentId: z.string(),
        accountId: z.string().optional().describe("PaymentBankAccount de destino. Default: a sugerida pela inspeção."),
      }),
      execute: async ({ attachmentId, accountId }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "create");
        if (!access.ok) return { error: access.error };

        const result = await inspectStatementFromAttachment({
          organizationId: ctx.organizationId,
          attachmentId,
          userId: ctx.userId,
        });
        if (!result.ok) return { error: result.message, reason: result.reason };
        const { inspection } = result;
        if (inspection.transactionCount === 0) {
          return { error: "Não encontrei movimentações neste extrato. Confira se o arquivo é o extrato da conta." };
        }

        const targetAccountId = accountId ?? inspection.suggestedAccountId;
        if (!targetAccountId) {
          const accounts = await loadActiveAccounts();
          return {
            error: "Não identifiquei a conta de destino. Pergunte ao usuário em qual conta importar.",
            accounts: accounts.map((account) => ({ id: account.id, name: account.name, bankName: account.bankName })),
          };
        }

        const account = await prisma.paymentBankAccount.findFirst({
          where: { id: targetAccountId, organizationId: ctx.organizationId },
          select: { id: true, name: true, ofxAccountId: true },
        });
        if (!account) return { error: `accountId "${targetAccountId}" inválido. Use list_payment_accounts.` };

        const mismatchMessage = describeStatementAccountMismatch(
          { accountId: inspection.statementAccountId, source: inspection.source },
          account,
        );
        if (mismatchMessage) return { error: mismatchMessage, reason: "account_mismatch" };

        const [alreadyImportedAt, pdfStarsCost] = await Promise.all([
          findPreviousStatementImport({
            organizationId: ctx.organizationId,
            accountId: account.id,
            fileHash: inspection.fileHash,
          }),
          inspection.kind === "PDF" ? loadPdfImportStarsCost() : Promise.resolve(0),
        ]);

        const isSuggestedAccount = account.id === inspection.suggestedAccountId;
        const lines: AstroConfirmationLine[] = [
          { label: "Arquivo", value: inspection.fileName ?? attachmentId },
          { label: "Formato", value: inspection.kind === "PDF" ? "PDF (lido por IA)" : "OFX" },
          { label: "Banco", value: inspection.bankName ?? inspection.bankId ?? "não identificado" },
          { label: "Conta no extrato", value: inspection.statementAccountId ?? "não informada" },
          { label: "Período", value: formatPeriod(inspection) },
          {
            label: "Transações",
            value: `${inspection.transactionCount} · entradas ${formatBRL(inspection.creditCents)} · saídas ${formatBRL(inspection.debitCents)}`,
          },
          {
            label: "Importar para",
            value: isSuggestedAccount ? `${account.name} (${MATCH_REASON_LABELS[inspection.matchReason]})` : account.name,
          },
        ];
        if (inspection.kind === "PDF" && pdfStarsCost > 0 && !alreadyImportedAt) {
          lines.push({ label: "Custo", value: `${pdfStarsCost}★ ao confirmar` });
        }

        const warnings = relevantWarningMessages(inspection);
        if (inspection.kind === "PDF") {
          warnings.push("Extrato lido por IA — confira o nº de transações e os totais com o PDF antes de confirmar.");
        }
        if (alreadyImportedAt) {
          warnings.push(
            `Este arquivo já foi importado nesta conta em ${formatDateBR(alreadyImportedAt)} — nada será duplicado e não haverá cobrança.`,
          );
        }

        const payload: StatementImportProposalPayload = {
          attachmentId,
          accountId: account.id,
          kind: inspection.kind,
          fileName: inspection.fileName ?? attachmentId,
        };
        return createPendingAction({
          ctx,
          actionType: STATEMENT_ACTION_TYPES.importStatement,
          payload: payload as unknown as Record<string, unknown>,
          title: "Importar extrato bancário",
          lines,
          warnings,
        });
      },
    }),
  };
}
