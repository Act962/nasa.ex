"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Landmark,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { usePaymentDashboard, useCashflow } from "../../hooks/use-payment";
import { formatCurrency, formatPercent } from "../../lib/format";
import {
  usePaymentPeriodIso,
  usePaymentCategoryFilter,
} from "../../store/use-payment-filters-store";
import { DashboardToolbar } from "./dashboard-toolbar";
import { NewTransactionDialog } from "./new-transaction-dialog";
import { SummaryCard } from "./summary-card";
import { CashflowChartCard, type CashflowPoint } from "./cashflow-chart-card";
import { ExpensesByCategoryCard } from "./expenses-by-category-card";
import { EntriesPreviewCard } from "./entries-preview-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import {
  ExecutiveSummaryCard,
  type ExecutiveMetric,
} from "./executive-summary-card";

const OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;
const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** "2026-05" → "Mai" */
function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTH_LABELS[index] ?? month;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted/50" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-80 animate-pulse rounded-xl bg-muted/40" />
      </div>
    </div>
  );
}

export function PaymentDashboard({
  onExport,
  isExporting,
  onNavigateTab,
}: {
  onExport: () => void;
  isExporting: boolean;
  /** Leva o usuário pra aba correspondente ao clicar em "Ver todas". */
  onNavigateTab?: (tab: string) => void;
}) {
  const [granularity, setGranularity] = useState<"monthly" | "daily">("monthly");
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);

  const { dateFrom, dateTo } = usePaymentPeriodIso();
  const categoryIds = usePaymentCategoryFilter();

  const { data, isLoading } = usePaymentDashboard({ dateFrom, dateTo, categoryIds });
  const { data: cashflowData } = useCashflow({ dateFrom, dateTo, categoryIds });

  const chartPoints = useMemo<CashflowPoint[]>(() => {
    if (granularity === "daily") {
      return (cashflowData?.rows ?? []).map((row) => ({
        name: row.date.slice(8, 10),
        Receitas: row.receivable,
        Despesas: row.payable,
        Saldo: row.balance,
      }));
    }
    return (data?.monthlyChart ?? []).map((month) => ({
      name: monthLabel(month.month),
      Receitas: month.receivable,
      Despesas: month.payable,
      Saldo: month.result,
    }));
  }, [granularity, cashflowData, data]);

  const expenseSlices = useMemo(
    () =>
      (data?.categoryBreakdown ?? [])
        .filter((category) => category.type === "PAYABLE" && category.total > 0)
        .map((category) => ({
          name: category.categoryName,
          value: category.total,
        })),
    [data],
  );

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const today = new Date();
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const previousRevenue =
    data.previousPeriod.netResult + data.previousPeriod.totalPaid;

  const executiveMetrics: ExecutiveMetric[] = [
    {
      label: "Receita",
      value: formatCurrency(data.totalReceivable),
      hint: "Em aberto no período",
      tone: "emerald",
      onSelect: () => onNavigateTab?.("receivables"),
    },
    {
      label: "Despesa",
      value: formatCurrency(data.totalPayable),
      hint: "Em aberto no período",
      tone: "red",
      onSelect: () => onNavigateTab?.("payables"),
    },
    {
      label: "Faturamento",
      value: formatCurrency(data.executive.revenue),
      comparison: { current: data.executive.revenue, previous: previousRevenue },
      filter: {
        type: "RECEIVABLE",
        statuses: ["PAID", "PARTIAL"],
        paidFrom: dateFrom,
        paidTo: dateTo,
      },
      useSumOfPaid: true,
    },
    {
      label: "Lucro líquido",
      value: formatCurrency(data.executive.netProfit),
      comparison: {
        current: data.executive.netProfit,
        previous: data.previousPeriod.netResult,
      },
    },
    {
      label: "Ticket médio",
      value: formatCurrency(data.executive.averageTicket),
      hint: "Por recebimento confirmado",
    },
    {
      label: "Inadimplência",
      value: formatPercent(data.executive.defaultRatePercent),
      hint: `${formatCurrency(data.executive.overdueInPeriod)} vencidos no período`,
      filter: {
        type: "RECEIVABLE",
        statuses: ["OVERDUE"],
        dateFrom,
        dateTo,
      },
    },
    {
      label: "Reservas",
      value: formatCurrency(data.executive.reserves),
      hint: "Saldo em contas",
    },
  ];

  return (
    // pb extra no mobile: o dock flutuante de IA cobre o rodapé do último card.
    <div className="space-y-5 pb-16 lg:pb-0">
      <DashboardToolbar
        onExport={onExport}
        isExporting={isExporting}
        onNewTransaction={() => setNewTransactionOpen(true)}
      />

      <ExecutiveSummaryCard
        metrics={executiveMetrics}
        goalAchieved={data.executive.goalAchieved}
        goalTarget={data.executive.goalTarget}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Receita"
          value={formatCurrency(data.totalReceivable)}
          icon={Wallet}
          tone="emerald"
          current={data.totalReceivable}
          previous={data.previousPeriod.totalReceivable}
          filter={{
            type: "RECEIVABLE",
            statuses: [...OPEN_STATUSES],
            dateFrom,
            dateTo,
          }}
        />
        <SummaryCard
          label="Despesa"
          value={formatCurrency(data.totalPayable)}
          icon={Landmark}
          tone="red"
          current={data.totalPayable}
          previous={data.previousPeriod.totalPayable}
          higherIsBetter={false}
          filter={{
            type: "PAYABLE",
            statuses: [...OPEN_STATUSES],
            dateFrom,
            dateTo,
          }}
        />
        <SummaryCard
          label="Gastos do período"
          value={formatCurrency(data.totalPaid)}
          icon={BarChart3}
          tone="blue"
          current={data.totalPaid}
          previous={data.previousPeriod.totalPaid}
          higherIsBetter={false}
          filter={{
            type: "PAYABLE",
            statuses: ["PAID", "PARTIAL"],
            paidFrom: dateFrom,
            paidTo: dateTo,
          }}
          useSumOfPaid
        />
        <SummaryCard
          label="Saldo do período"
          value={formatCurrency(data.netResult)}
          icon={data.netResult >= 0 ? TrendingUp : TrendingDown}
          tone="violet"
          current={data.netResult}
          previous={data.previousPeriod.netResult}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CashflowChartCard
          points={chartPoints}
          granularity={granularity}
          onGranularityChange={setGranularity}
        />
        <ExpensesByCategoryCard items={expenseSlices} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <EntriesPreviewCard
          title="Receitas"
          tone="emerald"
          entries={data.upcomingReceivables}
          total={data.totalReceivable}
          totalLabel="Total de receitas"
          emptyMessage="Nenhuma receita no período."
          onSeeAll={() => onNavigateTab?.("receivables")}
          upcoming={{
            label: "Próximos 7 dias",
            value: data.upcoming7Days.receivable,
            filter: {
              type: "RECEIVABLE",
              statuses: ["PENDING", "PARTIAL"],
              dateFrom: today.toISOString(),
              dateTo: in7Days.toISOString(),
            },
          }}
        />
        <EntriesPreviewCard
          title="Despesas"
          tone="red"
          entries={data.upcomingPayables}
          total={data.totalPayable}
          totalLabel="Total de despesas"
          emptyMessage="Nenhuma despesa no período."
          onSeeAll={() => onNavigateTab?.("payables")}
          upcoming={{
            label: "Próximos 30 dias",
            value: data.upcoming30Days.payable,
            filter: {
              type: "PAYABLE",
              statuses: ["PENDING", "PARTIAL"],
              dateFrom: today.toISOString(),
              dateTo: in30Days.toISOString(),
            },
          }}
        />
        <div className="lg:col-span-2 xl:col-span-1">
          <RecentTransactionsCard
            transactions={data.recentTransactions}
            onSeeAll={() => onNavigateTab?.("cashflow")}
          />
        </div>
      </div>

      <NewTransactionDialog
        open={newTransactionOpen}
        onOpenChange={setNewTransactionOpen}
      />
    </div>
  );
}
