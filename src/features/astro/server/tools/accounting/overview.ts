import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { TaxAssessmentStatus } from "@/generated/prisma/client";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { formatBps, formatCentsBrl, quarterMonths, shiftMonthKey } from "@/features/accounting/lib/format";
import { REGIME_LABELS, formatPeriodLabel } from "@/features/accounting/lib/profile/tax-display";
import { buildAccountingSectionUrl } from "@/features/accounting/lib/accounting-sections";
import { loadAccountingOverview } from "@/features/accounting/server/overview/load-accounting-overview";
import { TAX_LABELS } from "@/features/accounting/server/assessments/assess-period";
import { assertAccountingReadAccess } from "./access";
import { currentMonthKey, loadExistingTaxProfile, PROFILE_MISSING_MESSAGE } from "./shared";

const MAX_ASSESSMENTS = 40;
const MEMO_STEPS_LIMIT = 6;

const ASSESSMENT_STATUS_LABELS: Record<TaxAssessmentStatus, string> = {
  DRAFT: "Rascunho — falta confirmar para virar guia",
  CONFIRMED: "Confirmada — guia lançada em Despesas, aguardando pagamento",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

function toDateLabel(date: Date | null): string | null {
  if (!date) return null;
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

/** A memória gravada é o `CalculationResult` da apuração; lida com narrowing porque é Json. */
function summarizeCalculationMemo(memo: unknown) {
  if (typeof memo !== "object" || memo === null) return { steps: [], warnings: [], sources: [] };
  const memoRecord = memo as Record<string, unknown>;
  const rawSteps = Array.isArray(memoRecord.steps) ? memoRecord.steps : [];
  const steps = rawSteps
    .filter((step): step is Record<string, unknown> => typeof step === "object" && step !== null)
    .slice(0, MEMO_STEPS_LIMIT)
    .map((step) => ({
      label: readString(step, "label") ?? "",
      value: readString(step, "value") ?? "",
      legalSource: readString(step, "legalSource"),
    }));
  const rawWarnings = Array.isArray(memoRecord.warnings) ? memoRecord.warnings : [];
  const warnings = rawWarnings
    .map((warning) => (typeof warning === "object" && warning !== null ? readString(warning as Record<string, unknown>, "message") : null))
    .filter((message): message is string => Boolean(message));
  const sources = (Array.isArray(memoRecord.sources) ? memoRecord.sources : []).filter(
    (source): source is string => typeof source === "string",
  );
  return { steps, warnings, sources };
}

export function buildAccountingOverviewTools(ctx: AgentContext) {
  return {
    get_accounting_overview: tool({
      description:
        "VISÃO GERAL da aba Contábil (o mesmo painel que o usuário vê em Contábil › Visão geral): regime, se o cadastro fiscal foi concluído, SCORE DE REGULARIDADE, quantos itens travam e quantos estão pendentes, guias/declarações ATRASADAS, próximas obrigações, situação da GUIA DO MÊS PASSADO (apurada? rascunho sem confirmar? valor), créditos de IBS/CBS disponíveis e quantas DESPESAS PAGAS ESTÃO SEM NOTA. Use como PRIMEIRA chamada para perguntas amplas: 'como está minha contabilidade?', 'tá tudo em dia com o fisco?', 'o que preciso resolver na parte fiscal?', 'resumo contábil', ou quando o usuário estiver na Visão geral da aba Contábil. Para detalhar um ponto, chame a tool específica depois.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const profile = await loadExistingTaxProfile(ctx.organizationId);
        if (!profile) return { configured: false, message: PROFILE_MISSING_MESSAGE, url: buildAccountingSectionUrl("profile") };

        const overview = await loadAccountingOverview({ organizationId: ctx.organizationId, profile });
        const now = Date.now();
        return {
          regime: REGIME_LABELS[overview.regime],
          isOnboarded: overview.isOnboarded,
          regularityScore: formatBps(overview.scoreBps, 0),
          blockingItemsCount: overview.blockingCount,
          pendingItemsCount: overview.pendingItemsCount,
          overdueObligationsCount: overview.overdueObligationsCount,
          nextObligations: overview.nextObligations.map((obligation) => ({
            label: obligation.label,
            period: formatPeriodLabel(obligation.period),
            dueDate: toDateLabel(obligation.dueDate),
            isOverdue: obligation.status === "OVERDUE" || obligation.dueDate.getTime() < now,
          })),
          lastMonthAssessment: {
            period: formatPeriodLabel(overview.lastMonth.period),
            hasAssessment: overview.lastMonth.hasAssessment,
            draftsWaitingConfirmation: overview.lastMonth.draftCount,
            totalAmount: formatCentsBrl(overview.lastMonth.totalAmountCents),
          },
          availableCredits: {
            cbs: formatCentsBrl(overview.availableCredits.cbsCents),
            ibs: formatCentsBrl(overview.availableCredits.ibsCents),
          },
          paidExpensesWithoutInvoiceSinceLastMonth: overview.paidWithoutInvoiceCount,
          glossaryTermIds: ["score-regularidade", "obrigacao-acessoria", "credito-nao-cumulativo"],
          links: {
            overview: buildAccountingSectionUrl("overview"),
            documents: buildAccountingSectionUrl("documents"),
            assessments: buildAccountingSectionUrl("assessments"),
            calendar: buildAccountingSectionUrl("calendar"),
            credits: buildAccountingSectionUrl("credits"),
          },
        };
      },
    }),

    list_tax_assessments: tool({
      description:
        "APURAÇÕES JÁ FEITAS (Contábil › Apurações e guias): por mês ou trimestre, cada tributo apurado (DAS, DAS-MEI, IRPJ, CSLL, PIS, COFINS, ISS, CBS, IBS...) com base, alíquota efetiva, créditos abatidos, VALOR DA GUIA, vencimento, situação (rascunho, confirmada = guia lançada em Despesas, paga) e um resumo da memória de cálculo com a base legal. Diferente de simulate_das: aqui é o que foi GRAVADO. Use para 'quanto deu o DAS de agosto?', 'já apurei o mês passado?', 'quanto paguei de imposto este ano?', 'qual guia falta confirmar?', 'por que meu imposto deu X?'.",
      inputSchema: z.object({
        fromMonth: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
          .optional()
          .describe("Primeiro mês AAAA-MM. Default: 6 meses atrás."),
        toMonth: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
          .optional()
          .describe("Último mês AAAA-MM. Default: mês atual."),
        status: z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]).optional().describe("Filtrar por situação."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const profile = await loadExistingTaxProfile(ctx.organizationId);
        if (!profile) return { configured: false, message: PROFILE_MISSING_MESSAGE, url: buildAccountingSectionUrl("profile") };

        const toMonth = input.toMonth ?? currentMonthKey();
        const fromMonth = input.fromMonth ?? shiftMonthKey(toMonth, -6);
        // "AAAA-Tn" ordena depois dos meses do mesmo ano: o banco traz o ano
        // inteiro e o filtro abaixo recorta mês e trimestre.
        const assessments = await prisma.taxAssessment.findMany({
          where: {
            organizationId: ctx.organizationId,
            period: { gte: fromMonth, lte: `${toMonth.slice(0, 4)}-T4` },
            ...(input.status ? { status: input.status } : {}),
          },
          orderBy: [{ period: "desc" }, { tax: "asc" }],
          take: MAX_ASSESSMENTS,
        });
        const inRange = assessments.filter((assessment) => {
          if (!assessment.period.includes("-T")) return assessment.period <= toMonth;
          const months = quarterMonths(assessment.period);
          return months[months.length - 1] >= fromMonth && months[0] <= toMonth;
        });

        const rows = inRange.map((assessment) => ({
          period: formatPeriodLabel(assessment.period),
          periodKey: assessment.period,
          tax: TAX_LABELS[assessment.tax],
          base: formatCentsBrl(assessment.baseCents),
          effectiveRate: formatBps(assessment.effectiveRateBps, 4),
          creditsDeducted: assessment.creditsCents > 0 ? formatCentsBrl(assessment.creditsCents) : null,
          amount: formatCentsBrl(assessment.amountCents),
          dueDate: toDateLabel(assessment.dueDate),
          status: assessment.status,
          statusLabel: ASSESSMENT_STATUS_LABELS[assessment.status],
          hasPaymentEntry: Boolean(assessment.paymentEntryId),
          memo: summarizeCalculationMemo(assessment.calculationMemo),
        }));
        const activeRows = inRange.filter((assessment) => assessment.status !== "CANCELLED");

        return {
          window: `${fromMonth} a ${toMonth}`,
          count: rows.length,
          totalAmount: formatCentsBrl(activeRows.reduce((total, assessment) => total + assessment.amountCents, 0)),
          draftsWaitingConfirmation: inRange.filter((assessment) => assessment.status === "DRAFT").length,
          assessments: rows,
          note: rows.length === 0
            ? "Nenhuma apuração gravada nesse período. Para calcular sem gravar use simulate_das; para gerar a guia o usuário apura e confirma na tela."
            : "Confirmar a apuração cria a guia como conta a pagar em Despesas (categoria Impostos e taxas).",
          url: buildAccountingSectionUrl("assessments"),
        };
      },
    }),
  };
}
