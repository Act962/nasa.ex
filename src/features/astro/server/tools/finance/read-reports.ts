import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroChartPayload } from "@/features/astro/lib/astro-chart";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";
import { loadPaymentDashboard } from "@/features/payment/server/dashboard/load-dashboard";
import {
  loadCashflow,
  loadCashflowDayEntries,
} from "@/features/payment/server/cashflow/load-cashflow";
import { loadPaymentProjection } from "@/features/payment/server/projection/load-projection";
import { loadGoalStatus } from "@/features/payment/server/goals/goal-status";
import {
  loadIncomeStatement,
  loadOperationalResult,
} from "@/features/payment/server/reports/load-reports";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR, resolveMonthInput } from "./payloads";

// Tools financeiras de LEITURA agregada (spec 0014, RF-2): painel, fluxo de
// caixa, projeção, metas, DRE e DRO. Usam os mesmos serviços das telas.

const periodInput = z.object({
  month: z.number().int().min(1).max(12).optional().describe("Mês (1-12). Default: mês atual."),
  year: z.number().int().optional().describe("Ano. Default: ano atual."),
  dateFromIso: z.string().optional().describe("Início do range (AAAA-MM-DD). Tem precedência sobre month/year."),
  dateToIso: z.string().optional().describe("Fim do range (AAAA-MM-DD)."),
  categoryIds: z.array(z.string()).optional(),
});

export function buildFinanceReportTools(ctx: AgentContext) {
  return {
    get_finance_dashboard: tool({
      description:
        "PAINEL financeiro do período (default: mês atual): a receber, a pagar, recebido, pago, vencidos, saldo em contas, resultado, próximos 7/30 dias, receita/despesa por categoria, comparação com o período anterior, ticket médio e inadimplência. Use pra 'quanto tenho a pagar/receber', 'como está o mês', 'saldo', 'resultado', 'inadimplência'. Mesmos números do Painel em /payment.",
      inputSchema: periodInput,
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const summary = await loadPaymentDashboard({
          organizationId: ctx.organizationId,
          month: input.month,
          year: input.year,
          dateFrom: input.dateFromIso,
          dateTo: input.dateToIso,
          categoryIds: input.categoryIds,
        });
        return {
          period: {
            from: summary.period.start.toISOString().slice(0, 10),
            to: summary.period.end.toISOString().slice(0, 10),
          },
          totals: {
            receivableOpenCents: summary.totalReceivable,
            payableOpenCents: summary.totalPayable,
            receivedCents: summary.totalReceived,
            paidCents: summary.totalPaid,
            overdueReceivableCents: summary.overdueReceivable,
            overduePayableCents: summary.overduePayable,
            bankBalanceCents: summary.balanceTotal,
            netResultCents: summary.netResult,
          },
          upcoming7Days: summary.upcoming7Days,
          upcoming30Days: summary.upcoming30Days,
          previousPeriod: summary.previousPeriod,
          executive: summary.executive,
          categoryBreakdown: summary.categoryBreakdown,
          upcomingPayables: summary.upcomingPayables.map((entry) => ({
            id: entry.id,
            description: entry.description,
            contactName: entry.contactName,
            amountCents: entry.amount,
            dueDate: entry.dueDate.toISOString().slice(0, 10),
          })),
          upcomingReceivables: summary.upcomingReceivables.map((entry) => ({
            id: entry.id,
            description: entry.description,
            contactName: entry.contactName,
            amountCents: entry.amount,
            dueDate: entry.dueDate.toISOString().slice(0, 10),
          })),
          formatted: {
            receivableOpen: formatBRL(summary.totalReceivable),
            payableOpen: formatBRL(summary.totalPayable),
            received: formatBRL(summary.totalReceived),
            paid: formatBRL(summary.totalPaid),
            bankBalance: formatBRL(summary.balanceTotal),
            netResult: formatBRL(summary.netResult),
          },
        };
      },
    }),

    get_finance_metrics: tool({
      description:
        "Resumo compacto de FINANCEIRO por período (receita, despesa, resultado, ticket médio, inadimplência, por categoria). Alias histórico — prefira get_finance_dashboard, que traz mais detalhe.",
      inputSchema: z.object({
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        categoryIds: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const summary = await loadPaymentDashboard({
          organizationId: ctx.organizationId,
          dateFrom: input.fromIso,
          dateTo: input.toIso,
          categoryIds: input.categoryIds,
        });
        return {
          period: { from: summary.period.start.toISOString(), to: summary.period.end.toISOString() },
          receivable: {
            pendingCents: summary.totalReceivable,
            overdueCents: summary.overdueReceivable,
            receivedInPeriodCents: summary.totalReceived,
          },
          payable: {
            pendingCents: summary.totalPayable,
            overdueCents: summary.overduePayable,
            paidInPeriodCents: summary.totalPaid,
          },
          result: { netCents: summary.netResult },
          avgTicketReceivedCents: summary.executive.averageTicket,
          overdueRatePercent: Math.round(summary.executive.defaultRatePercent * 10) / 10,
          byCategory: summary.categoryBreakdown.map((row) => ({
            categoryId: row.categoryId,
            name: row.categoryName,
            type: row.type,
            totalCents: row.total,
          })),
        };
      },
    }),

    get_cashflow: tool({
      description:
        "FLUXO DE CAIXA diário do período (default: mês atual): entradas, saídas e saldo acumulado por dia. Retorna também um gráfico de linha. Use pra 'fluxo de caixa', 'quanto entra e sai por dia', 'evolução do caixa no mês'.",
      inputSchema: periodInput,
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const { rows, period } = await loadCashflow({
          organizationId: ctx.organizationId,
          month: input.month,
          year: input.year,
          dateFrom: input.dateFromIso,
          dateTo: input.dateToIso,
          categoryIds: input.categoryIds,
        });
        const totalIn = rows.reduce((sum, row) => sum + row.receivable, 0);
        const totalOut = rows.reduce((sum, row) => sum + row.payable, 0);
        const chart: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "line",
          title: "Saldo acumulado do fluxo de caixa",
          caption: `${formatDateBR(period.start)} a ${formatDateBR(period.end)} · entradas ${formatBRL(totalIn)} · saídas ${formatBRL(totalOut)}`,
          xLabel: "Dia",
          yLabel: "Saldo",
          valueFormat: "currency",
          data: rows.map((row) => ({ label: formatDateBR(row.date), value: row.balance })),
        };
        return {
          ...chart,
          summary: {
            totalInCents: totalIn,
            totalOutCents: totalOut,
            finalBalanceCents: rows.at(-1)?.balance ?? 0,
            days: rows.length,
          },
          rows: rows.slice(0, 62),
        };
      },
    }),

    get_cashflow_day: tool({
      description:
        "Lançamentos que compõem UM DIA do fluxo de caixa (o que vence/entra/sai naquele dia). Use pra 'o que vence dia 20', 'o que entra amanhã'.",
      inputSchema: z.object({
        dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("AAAA-MM-DD"),
        categoryIds: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const { entries, totals } = await loadCashflowDayEntries({
          organizationId: ctx.organizationId,
          date: input.dateIso,
          categoryIds: input.categoryIds,
        });
        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: `Fluxo de caixa de ${formatDateBR(input.dateIso)}`,
          caption: `Entradas ${formatBRL(totals.receivable)} · Saídas ${formatBRL(totals.payable)}`,
          totalCount: entries.length,
          columns: [
            { key: "description", label: "Descrição" },
            { key: "typeLabel", label: "Tipo", type: "badge" },
            { key: "cashAmount", label: "Valor", type: "currency" },
            { key: "status", label: "Status", type: "badge" },
            { key: "contact", label: "Contato" },
            { key: "category", label: "Categoria" },
          ],
          rows: entries.map((entry) => ({
            id: entry.id,
            description: entry.description,
            typeLabel: entry.type === "PAYABLE" ? "Despesa" : "Receita",
            cashAmount: entry.cashAmount,
            status: entry.status,
            contact: entry.contactName ?? "—",
            category: entry.categoryName ?? "—",
          })),
        };
        return table;
      },
    }),

    get_finance_projection: tool({
      description:
        "PROJEÇÃO de caixa pros próximos meses (3, 6 ou 12): saldo inicial, comprometido vs estimado por mês, vencidos puxados pro mês 1, saldo projetado e confiança. Use pra 'projeção', 'como fecha o mês que vem', 'vai faltar caixa', 'previsão'.",
      inputSchema: z.object({
        horizonMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]).optional(),
        categoryIds: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const projection = await loadPaymentProjection({
          organizationId: ctx.organizationId,
          horizonMonths: input.horizonMonths,
          categoryIds: input.categoryIds,
        });
        const chart: AstroChartPayload = {
          kind: "astro_chart",
          chartType: "bar",
          title: "Saldo projetado por mês",
          caption: `Saldo inicial ${formatBRL(projection.openingBalance)} · média mensal entradas ${formatBRL(projection.monthlyAverageIn)} / saídas ${formatBRL(projection.monthlyAverageOut)}`,
          valueFormat: "currency",
          data: projection.months.map((month) => ({ label: month.label, value: month.projectedBalance })),
        };
        return { ...chart, projection };
      },
    }),

    get_finance_goal_status: tool({
      description:
        "META de receita e RESERVA mínima de caixa do mês: meta, recebido, progresso, caixa projetado, reserva alvo, folga/gap e se a reserva está em risco. Use pra 'bati a meta', 'reserva de caixa', 'quanto falta pra meta'.",
      inputSchema: z.object({
        month: z.number().int().min(1).max(12).optional(),
        year: z.number().int().optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const { year, month } = resolveMonthInput(input);
        const status = await loadGoalStatus({ organizationId: ctx.organizationId, year, month });
        return {
          ...status,
          formatted: {
            revenueTarget: formatBRL(status.revenueTargetCents),
            receivedRevenue: formatBRL(status.receivedRevenue),
            projectedCash: formatBRL(status.projectedCash),
            reserveTargetProjected: formatBRL(status.reserveTargetProjected),
            reserveGap: formatBRL(status.reserveGap),
          },
        };
      },
    }),

    get_income_statement: tool({
      description:
        "DRE do período (default: mês atual): receita, custos, despesas, lucro bruto, resultado líquido e margens, por categoria. regime 'cash' = o que entrou/saiu de fato; 'accrual' = competência (vencimento). Use pra 'DRE', 'lucro', 'margem', 'resultado do exercício'.",
      inputSchema: z.object({
        dateFromIso: z.string().optional(),
        dateToIso: z.string().optional(),
        regime: z.enum(["cash", "accrual"]).optional(),
        categoryIds: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const statement = await loadIncomeStatement({
          organizationId: ctx.organizationId,
          dateFrom: input.dateFromIso,
          dateTo: input.dateToIso,
          regime: input.regime,
          categoryIds: input.categoryIds,
        });
        return {
          ...statement,
          period: {
            from: statement.period.start.toISOString().slice(0, 10),
            to: statement.period.end.toISOString().slice(0, 10),
          },
          formatted: {
            revenue: formatBRL(statement.revenue.total),
            costs: formatBRL(statement.costs.total),
            expenses: formatBRL(statement.expenses.total),
            grossProfit: formatBRL(statement.grossProfit),
            netResult: formatBRL(statement.netResult),
          },
        };
      },
    }),

    get_operational_result: tool({
      description:
        "DRO — resultado por centro de custo no período: receita, despesas, resultado e margem de cada centro. Use pra 'DRO', 'resultado por centro de custo', 'qual área dá mais lucro'.",
      inputSchema: z.object({
        dateFromIso: z.string().optional(),
        dateToIso: z.string().optional(),
        regime: z.enum(["cash", "accrual"]).optional(),
        categoryIds: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "dashboard", "view");
        if (!access.ok) return { error: access.error };
        const result = await loadOperationalResult({
          organizationId: ctx.organizationId,
          dateFrom: input.dateFromIso,
          dateTo: input.dateToIso,
          regime: input.regime,
          categoryIds: input.categoryIds,
        });
        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "DRO — resultado por centro de custo",
          caption: `Receita ${formatBRL(result.totals.revenue)} · Despesas ${formatBRL(result.totals.expenses)} · Resultado ${formatBRL(result.totals.result)}`,
          totalCount: result.rows.length,
          columns: [
            { key: "costCenterName", label: "Centro de custo" },
            { key: "revenue", label: "Receita", type: "currency" },
            { key: "expenses", label: "Despesas", type: "currency" },
            { key: "result", label: "Resultado", type: "currency" },
            { key: "margin", label: "Margem" },
          ],
          rows: result.rows.map((row) => ({
            id: row.costCenterId ?? "sem-centro",
            costCenterName: row.costCenterName,
            revenue: row.revenue,
            expenses: row.expenses,
            result: row.result,
            margin: `${row.marginPercent.toFixed(1)}%`,
          })),
        };
        return table;
      },
    }),
  };
}
