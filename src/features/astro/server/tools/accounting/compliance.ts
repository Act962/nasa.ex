import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { findDocumentType, DOCUMENT_GROUP_LABELS } from "@/features/accounting/lib/compliance/document-catalog";
import type { RegularityItem } from "@/features/accounting/lib/compliance/compute-regularity-score";
import { loadRegularityScore } from "@/features/accounting/server/compliance/load-regularity";
import { loadAvailableCredits } from "@/features/accounting/server/credits/load-available-credits";
import { loadCreditSummary } from "@/features/accounting/server/credits/load-credit-reports";
import { assertAccountingReadAccess, ACCOUNTING_TAB_URL } from "./access";
import { currentMonthKey, loadExistingTaxProfile, PROFILE_MISSING_MESSAGE } from "./shared";

const DAY_MS = 86_400_000;
const MAX_ROWS = 30;
const CREDIT_HISTORY_MONTHS = 6;

const CREDIT_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento da nota",
  AVAILABLE: "Disponível para abater",
  USED: "Já usado numa apuração",
  GLOSSED: "Glosado (não aceito)",
};

function toDateLabel(date: Date | null): string | null {
  if (!date) return null;
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function toDocumentRow(item: RegularityItem) {
  const documentType = findDocumentType(item.typeCode);
  return {
    typeCode: item.typeCode,
    label: item.label,
    group: DOCUMENT_GROUP_LABELS[item.group],
    status: item.status,
    expiresAt: toDateLabel(item.expiresAt),
    daysToExpire: item.daysToExpire,
    openPeriods: item.openPeriods,
    scorePointsIfResolved: formatBps(item.impactBps, 1),
    blockingImpact: item.blockingImpact,
    authority: documentType?.authority ?? null,
    whereToGet: (documentType?.officialLinks ?? []).map((link) => ({ label: link.label, url: link.url })),
    glossaryTermId: documentType?.glossaryTermId ?? null,
  };
}

async function loadScoreForTool(organizationId: string) {
  const profile = await loadExistingTaxProfile(organizationId);
  if (!profile) return null;
  return loadRegularityScore(organizationId);
}

export function buildAccountingComplianceTools(ctx: AgentContext) {
  return {
    list_obligations_due: tool({
      description:
        "CALENDÁRIO FISCAL: guias e declarações da empresa (DAS, DAS-MEI, DCTFWeb, FGTS Digital, DEFIS, DASN-SIMEI, ISS, PIS/COFINS...) que vencem nos próximos N dias e as que já estão VENCIDAS, com valor da guia quando a apuração foi confirmada. Use para 'o que vence esse mês', 'tenho imposto atrasado?', 'quando vence o DAS', 'prazos fiscais'. Para multa/juros de uma guia atrasada, depois chame run_calculator com guia_atraso.",
      inputSchema: z.object({
        daysAhead: z.number().int().min(1).max(365).optional().describe("Janela à frente em dias. Default: 30."),
        includeOverdue: z.boolean().optional().describe("Incluir as vencidas. Default: true."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const now = new Date();
        const windowEnd = new Date(now.getTime() + (input.daysAhead ?? 30) * DAY_MS);
        const includeOverdue = input.includeOverdue ?? true;
        const obligations = await prisma.fiscalObligation.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ["PENDING", "OVERDUE"] },
            dueDate: includeOverdue ? { lte: windowEnd } : { gte: now, lte: windowEnd },
          },
          include: { assessment: { select: { amountCents: true, status: true } } },
          orderBy: { dueDate: "asc" },
          take: MAX_ROWS,
        });

        const rows = obligations.map((obligation) => {
          const daysToDue = Math.ceil((obligation.dueDate.getTime() - now.getTime()) / DAY_MS);
          const documentType = findDocumentType(obligation.kind);
          return {
            kind: obligation.kind,
            label: documentType?.label ?? obligation.kind,
            period: obligation.period,
            dueDate: toDateLabel(obligation.dueDate),
            daysToDue,
            isOverdue: obligation.dueDate.getTime() < now.getTime(),
            amount: obligation.assessment && obligation.assessment.amountCents > 0 ? formatCentsBrl(obligation.assessment.amountCents) : null,
            assessmentStatus: obligation.assessment?.status ?? null,
            authority: documentType?.authority ?? null,
            officialLinks: (documentType?.officialLinks ?? []).map((link) => ({ label: link.label, url: link.url })),
          };
        });

        return {
          count: rows.length,
          overdueCount: rows.filter((row) => row.isOverdue).length,
          obligations: rows,
          url: `${ACCOUNTING_TAB_URL}&sub=calendar`,
          note: "Status atualizado pelo cron noturno; guia paga hoje pode aparecer como pendente até lá.",
        };
      },
    }),

    list_available_credits: tool({
      description:
        "CRÉDITOS DE IBS/CBS das notas de entrada (compras de fornecedores): quanto a empresa tem DISPONÍVEL para abater na apuração, quanto está aguardando o pagamento da nota (o crédito só nasce quando a nota é paga — LC 214/2025, art. 47), o que já foi usado e os maiores fornecedores geradores de crédito. Use para 'tenho crédito de imposto?', 'quanto posso abater', 'quais notas geram crédito', 'crédito não cumulativo'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const periodMonth = currentMonthKey();
        const [available, creditSummary] = await Promise.all([
          loadAvailableCredits({ organizationId: ctx.organizationId, upToMonth: periodMonth }),
          loadCreditSummary(ctx.organizationId, CREDIT_HISTORY_MONTHS),
        ]);
        const byStatus = await prisma.taxCredit.groupBy({
          by: ["status"],
          where: { organizationId: ctx.organizationId, tax: { in: ["CBS", "IBS"] } },
          _sum: { amountCents: true },
          _count: { _all: true },
        });
        const bySupplier = await prisma.taxCredit.groupBy({
          by: ["supplierName"],
          where: { organizationId: ctx.organizationId, tax: { in: ["CBS", "IBS"] }, status: { in: ["AVAILABLE", "PENDING_PAYMENT"] } },
          _sum: { amountCents: true },
          orderBy: { _sum: { amountCents: "desc" } },
          take: 5,
        });

        return {
          availableNow: {
            cbs: formatCentsBrl(available.cbsCents),
            ibs: formatCentsBrl(available.ibsCents),
            total: formatCentsBrl(available.cbsCents + available.ibsCents),
          },
          byStatus: byStatus.map((group) => ({
            status: group.status,
            label: CREDIT_STATUS_LABELS[group.status] ?? group.status,
            notes: group._count._all,
            amount: formatCentsBrl(group._sum.amountCents ?? 0),
          })),
          topSuppliers: bySupplier.map((group) => ({
            supplierName: group.supplierName ?? "Fornecedor sem nome",
            amount: formatCentsBrl(group._sum.amountCents ?? 0),
          })),
          lastMonths: creditSummary.months.map((month) => ({
            month: month.month,
            cbsAvailable: formatCentsBrl(month.cbsAvailableCents),
            ibsAvailable: formatCentsBrl(month.ibsAvailableCents),
            waitingPayment: formatCentsBrl(month.pendingPaymentCents),
            used: formatCentsBrl(month.usedCents),
          })),
          isTestYear: creditSummary.isTestYear,
          glossaryTermIds: ["credito-nao-cumulativo", "cbs", "ibs"],
          note: creditSummary.isTestYear
            ? "2026 é ano-teste: o crédito aparece, mas só abate imposto de verdade a partir de 2027. Ranking de fornecedores: list_credit_suppliers; despesas sem nota: list_expenses_without_nf."
            : "Ranking de fornecedores: list_credit_suppliers; despesas sem nota: list_expenses_without_nf.",
          url: `${ACCOUNTING_TAB_URL}&sub=credits`,
        };
      },
    }),

    get_regularity_score: tool({
      description:
        "SCORE DE REGULARIDADE da empresa (0–100%): quanto dos documentos e obrigações aplicáveis está em dia (certidões, alvarás, certificado digital, guias e notas do mês), ponderado pela importância. Devolve o score, os itens que travam licitação/nota/crédito e o que mais sobe o score se resolvido. Use para 'minha empresa está regular?', 'posso participar de licitação?', 'por que meu score caiu', 'o que falta regularizar'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const score = await loadScoreForTool(ctx.organizationId);
        if (!score) return { error: PROFILE_MISSING_MESSAGE };

        const pendingItems = score.items.filter((item) => item.status !== "OK");
        return {
          score: formatBps(score.scoreBps, 0),
          scoreBps: score.scoreBps,
          applicableItems: score.applicableCount,
          okItems: score.okCount,
          blockingItems: score.blockingItems.map(toDocumentRow),
          topPendingByImpact: pendingItems.slice(0, 8).map(toDocumentRow),
          glossaryTermIds: ["score-regularidade", "cnd", "crf-fgts", "cndt", "certificado-digital"],
          url: `${ACCOUNTING_TAB_URL}&sub=documents`,
        };
      },
    }),

    list_missing_documents: tool({
      description:
        "DOCUMENTOS FALTANDO: documentos da empresa que nunca foram anexados (contrato social, cartão CNPJ, alvará, certidões...) e meses com guia ou nota em aberto, ordenados pelo quanto sobem o score de regularidade. Cada item traz o órgão emissor e o LINK OFICIAL para tirar o documento. Use para 'que documentos faltam', 'o que preciso anexar', 'como tiro a certidão X'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const score = await loadScoreForTool(ctx.organizationId);
        if (!score) return { error: PROFILE_MISSING_MESSAGE };

        const missingItems = score.items.filter((item) => item.status === "MISSING" || item.status === "OVERDUE");
        return {
          count: missingItems.length,
          documents: missingItems.slice(0, MAX_ROWS).map(toDocumentRow),
          url: `${ACCOUNTING_TAB_URL}&sub=documents`,
        };
      },
    }),

    list_expiring_documents: tool({
      description:
        "DOCUMENTOS VENCENDO OU VENCIDOS: certidões (CND federal, CRF do FGTS, CNDT, estaduais/municipais), alvarás, licenças e certificado digital que vencem nos próximos N dias ou já venceram, com a data e o link oficial para renovar. Use para 'o que está vencendo', 'minha certidão está válida?', 'quando vence o certificado digital'.",
      inputSchema: z.object({
        withinDays: z.number().int().min(1).max(365).optional().describe("Janela à frente em dias. Default: 60."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const score = await loadScoreForTool(ctx.organizationId);
        if (!score) return { error: PROFILE_MISSING_MESSAGE };

        const withinDays = input.withinDays ?? 60;
        const expiringItems = score.items
          .filter((item) => item.daysToExpire !== null && (item.status === "EXPIRED" || item.daysToExpire <= withinDays))
          .sort((left, right) => (left.daysToExpire ?? 0) - (right.daysToExpire ?? 0));
        return {
          count: expiringItems.length,
          expiredCount: expiringItems.filter((item) => item.status === "EXPIRED").length,
          documents: expiringItems.slice(0, MAX_ROWS).map(toDocumentRow),
          url: `${ACCOUNTING_TAB_URL}&sub=documents`,
        };
      },
    }),
  };
}
