import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { buildAccountingSectionUrl } from "@/features/accounting/lib/accounting-sections";
import { listCompanyDocuments } from "@/features/accounting/server/documents/list-company-documents";
import { loadMissingInvoices, loadSupplierRanking } from "@/features/accounting/server/credits/load-credit-reports";
import { loadBalanceSheet, loadTrialBalance } from "@/features/accounting/server/reports/load-ledger-reports";
import { assertAccountingReadAccess } from "./access";
import { loadExistingTaxProfile, PROFILE_MISSING_MESSAGE } from "./shared";

// Documentos cadastrados, relatórios de crédito e demonstrações contábeis —
// leituras dos mesmos serviços que alimentam as subabas.

const MAX_ROWS = 30;
const MAX_TOP_ACCOUNTS = 8;

const DOCUMENT_STATUS_LABELS = {
  VALID: "Válido",
  EXPIRING_SOON: "Vencendo em breve",
  EXPIRED: "Vencido",
  PENDING_REVIEW: "Aguardando revisão da leitura da IA",
  REPLACED: "Substituído por versão mais nova",
} as const;

function toDateLabel(date: Date | null): string | null {
  if (!date) return null;
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function parseDateInput(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function buildAccountingBooksTools(ctx: AgentContext) {
  return {
    list_company_documents: tool({
      description:
        "DOCUMENTOS JÁ CADASTRADOS da empresa (Contábil › N-Box · Documentos): cada documento anexado — contrato social, cartão CNPJ, alvará, certidões (CND, CRF do FGTS, CNDT, estaduais e municipais), licenças, certificado digital — com número, emissão, VALIDADE (escrita ou estimada pela validade padrão do tipo), dias para vencer e situação (válido, vencendo, vencido, aguardando revisão). Use para 'quais documentos eu tenho?', 'minha CND está válida até quando?', 'quais documentos estão vencidos?', 'o certificado digital vence quando?'. Para o que NUNCA foi anexado use list_missing_documents; para o impacto no score, get_regularity_score.",
      inputSchema: z.object({
        onlyAttention: z.boolean().optional().describe("Só vencidos, vencendo ou aguardando revisão. Default: false."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const documents = await listCompanyDocuments(ctx.organizationId);
        const current = documents.filter((document) => document.displayStatus !== "REPLACED");
        const selected = input.onlyAttention
          ? current.filter((document) => document.displayStatus !== "VALID")
          : current;
        return {
          count: selected.length,
          expiredCount: current.filter((document) => document.displayStatus === "EXPIRED").length,
          expiringSoonCount: current.filter((document) => document.displayStatus === "EXPIRING_SOON").length,
          pendingReviewCount: current.filter((document) => document.displayStatus === "PENDING_REVIEW").length,
          documents: selected.slice(0, MAX_ROWS).map((document) => ({
            type: document.typeLabel,
            typeCode: document.typeCode,
            group: document.groupLabel,
            scope: document.scopeLabel,
            number: document.number,
            period: document.period,
            issuedAt: toDateLabel(document.issuedAt),
            expiresAt: toDateLabel(document.effectiveExpiresAt),
            isExpiryEstimated: document.isExpiryEstimated,
            daysToExpire: document.daysToExpire,
            status: DOCUMENT_STATUS_LABELS[document.displayStatus],
            hasFile: document.file !== null,
          })),
          note: current.length === 0
            ? "Nenhum documento anexado ainda. Sugira começar pelo cartão CNPJ e pelas certidões federais (list_missing_documents traz o link oficial de cada um)."
            : "Validade estimada = calculada pela validade padrão do tipo, porque o documento não trazia a data.",
          url: buildAccountingSectionUrl("documents"),
        };
      },
    }),

    list_credit_suppliers: tool({
      description:
        "RANKING DE FORNECEDORES por crédito de IBS/CBS (Contábil › Créditos), últimos 12 meses: quanto a empresa comprou de cada um, quanto de crédito as notas dele geraram, a proporção crédito/compra, quantas compras estão SEM NOTA anexada e se o fornecedor é do Simples/MEI (gera crédito menor). Use para 'quais fornecedores me dão mais crédito?', 'vale trocar de fornecedor por causa da Reforma?', 'de quem eu compro sem nota?'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const ranking = await loadSupplierRanking(ctx.organizationId);
        return {
          count: ranking.length,
          suppliers: ranking.slice(0, MAX_ROWS).map((supplier) => ({
            name: supplier.name,
            purchased: formatCentsBrl(supplier.purchasedCents),
            credit: formatCentsBrl(supplier.creditCents),
            creditRatio: formatBps(supplier.creditRatioBps),
            purchases: supplier.entryCount,
            purchasesWithoutInvoice: supplier.entriesWithoutInvoiceCount,
            isSimplesOrMei: supplier.isSimplesLike,
          })),
          glossaryTermIds: ["credito-nao-cumulativo", "cbs", "ibs", "simples-por-fora"],
          note: "Em 2026 (ano-teste) o crédito é só informativo. Fornecedor do Simples que não opta por recolher IBS/CBS por fora transfere crédito menor.",
          url: buildAccountingSectionUrl("credits"),
        };
      },
    }),

    list_expenses_without_nf: tool({
      description:
        "DESPESAS PAGAS SEM NOTA FISCAL nos últimos 3 meses (Contábil › Créditos): cada despesa paga sem nota/XML/recibo anexado, com valor, fornecedor e o CRÉDITO DE IBS/CBS ESTIMADO que está sendo perdido por falta da nota. Ignora a categoria 'Impostos e taxas'. Use para 'quais despesas estão sem nota?', 'quanto crédito estou perdendo?', 'o que falta anexar no financeiro?'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const report = await loadMissingInvoices(ctx.organizationId);
        return {
          count: report.items.length,
          totalAmount: formatCentsBrl(report.totalAmountCents),
          estimatedCreditLost: formatCentsBrl(report.totalEstimatedCreditCents),
          referenceRate: formatBps(report.rateBps),
          referenceYear: report.referenceYear,
          isRateEstimated: report.isEstimated,
          isFutureReference: report.isFutureReference,
          expenses: report.items.slice(0, MAX_ROWS).map((item) => ({
            description: item.description,
            amount: formatCentsBrl(item.amountCents),
            paidAt: toDateLabel(item.paidAt),
            category: item.categoryName,
            supplier: item.supplierName,
            estimatedCredit: formatCentsBrl(item.estimatedCreditCents),
          })),
          note: report.isFutureReference
            ? `Estimativa com a alíquota de ${report.referenceYear} (em 2026 o crédito ainda não é aproveitado). Anexe a nota na própria despesa em /payment.`
            : "Anexe a nota na própria despesa em /payment para o crédito nascer.",
          url: buildAccountingSectionUrl("credits"),
        };
      },
    }),

    get_ledger_summary: tool({
      description:
        "CONTABILIDADE DA EMPRESA (Contábil › Balancete e balanço): BALANÇO PATRIMONIAL numa data (total do ativo, passivo, patrimônio líquido e resultado do exercício, e se o balanço FECHA — ativo = passivo + PL) e o BALANCETE resumido de um período (total de débitos e créditos, se fecha, e as contas com maior movimento). Tudo gerado automaticamente dos lançamentos do financeiro por partidas dobradas. Use para 'qual o balanço da empresa?', 'meu balancete fecha?', 'quanto tenho de patrimônio?', 'qual o resultado do ano?'.",
      inputSchema: z.object({
        from: z.string().optional().describe("Início do balancete AAAA-MM-DD. Default: 1º de janeiro do ano corrente."),
        to: z.string().optional().describe("Fim do balancete e data do balanço AAAA-MM-DD. Default: hoje."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const profile = await loadExistingTaxProfile(ctx.organizationId);
        if (!profile) return { configured: false, message: PROFILE_MISSING_MESSAGE, url: buildAccountingSectionUrl("profile") };

        const today = new Date();
        const to = parseDateInput(input.to, today);
        const from = parseDateInput(input.from, new Date(Date.UTC(to.getUTCFullYear(), 0, 1)));
        const [trial, balanceSheet] = await Promise.all([
          loadTrialBalance({ organizationId: ctx.organizationId, from, to }),
          loadBalanceSheet({ organizationId: ctx.organizationId, at: to }),
        ]);

        const analyticalRows = trial.rows.filter((row) => row.isAnalytical);
        const totalDebitCents = analyticalRows.reduce((total, row) => total + row.debitCents, 0);
        const totalCreditCents = analyticalRows.reduce((total, row) => total + row.creditCents, 0);
        const topAccounts = [...analyticalRows]
          .sort((left, right) => right.debitCents + right.creditCents - (left.debitCents + left.creditCents))
          .filter((row) => row.debitCents + row.creditCents > 0)
          .slice(0, MAX_TOP_ACCOUNTS)
          .map((row) => ({
            code: row.code,
            name: row.name,
            debits: formatCentsBrl(row.debitCents),
            credits: formatCentsBrl(row.creditCents),
            closingBalance: formatCentsBrl(row.closingCents),
          }));

        return {
          balanceSheet: {
            at: toDateLabel(balanceSheet.at),
            assets: formatCentsBrl(balanceSheet.assets.totalCents),
            liabilities: formatCentsBrl(balanceSheet.liabilities.totalCents),
            equity: formatCentsBrl(balanceSheet.equity.totalCents),
            periodResult: formatCentsBrl(balanceSheet.equity.periodResultCents),
            isBalanced: balanceSheet.isBalanced,
          },
          trialBalance: {
            from: toDateLabel(from),
            to: toDateLabel(to),
            totalDebits: formatCentsBrl(totalDebitCents),
            totalCredits: formatCentsBrl(totalCreditCents),
            isBalanced: totalDebitCents === totalCreditCents,
            topAccounts,
          },
          hasMovement: totalDebitCents + totalCreditCents > 0,
          glossaryTermIds: ["balanco", "balancete", "partida-dobrada", "plano-de-contas", "razao"],
          note: "Os lançamentos contábeis são derivados do financeiro (não se edita o livro à mão). Se algo não fecha, o usuário pode reprocessar em Balancete e balanço ou revisar o mapeamento de categorias no Plano de contas.",
          url: buildAccountingSectionUrl("reports"),
        };
      },
    }),
  };
}
