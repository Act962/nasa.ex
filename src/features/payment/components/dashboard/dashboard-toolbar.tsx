"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2, Plus } from "lucide-react";
import {
  PaymentPeriodPicker,
  type PeriodRange,
} from "../shared/payment-period-picker";

export function DashboardToolbar({
  period,
  onPeriodChange,
  onExport,
  isExporting,
  onNewTransaction,
}: {
  period: PeriodRange;
  onPeriodChange: (range: PeriodRange) => void;
  onExport: () => void;
  isExporting: boolean;
  onNewTransaction: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="hidden min-w-0 sm:block">
        <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
          Painel Financeiro
        </h2>
        <p className="truncate text-sm text-muted-foreground">
          Visão geral da saúde financeira da empresa
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <PaymentPeriodPicker
          from={period.from}
          to={period.to}
          onChange={onPeriodChange}
          hideTime
          triggerClassName="h-9 w-full justify-center sm:w-auto sm:justify-start"
        />
        <div className="flex gap-2">
          {/* No mobile "Exportar" fica no menu sanduíche do header. */}
          <Button
            variant="outline"
            className="hidden h-9 gap-1.5 sm:inline-flex"
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exportar
          </Button>
          <Button
            className="h-9 w-full gap-1.5 sm:w-auto"
            onClick={onNewTransaction}
          >
            <Plus className="size-4" />
            Nova Transação
          </Button>
        </div>
      </div>
    </div>
  );
}
