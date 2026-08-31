"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type ReportRegime = "cash" | "accrual";

type ReportParams = {
  dateFrom?: string;
  dateTo?: string;
  regime: ReportRegime;
};

/** DRE — receitas, custos, despesas e margens do período. */
export function useIncomeStatement(params: ReportParams) {
  return useQuery(
    orpc.payment.reports.incomeStatement.queryOptions({ input: params }),
  );
}

/** DRO — resultado operacional por centro de custo. */
export function useOperationalResult(params: ReportParams) {
  return useQuery(
    orpc.payment.reports.operationalResult.queryOptions({ input: params }),
  );
}
