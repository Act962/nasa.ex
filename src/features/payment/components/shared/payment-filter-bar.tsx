"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { PaymentPeriodPicker } from "./payment-period-picker";
import { CategoryMultiSelect } from "./category-multi-select";
import {
  usePaymentFiltersStore,
  usePaymentPeriod,
} from "../../store/use-payment-filters-store";

// Barra única de filtros do módulo. Fica fixa logo abaixo das abas, de modo
// que o período e as categorias escolhidos valem para a aba atual e para as
// próximas — sem cada tela reiniciar o filtro no mês corrente.

interface PaymentFilterBarProps {
  /** A Projeção tem horizonte próprio (3/6/12 meses) e não usa período. */
  showPeriod?: boolean;
}

export function PaymentFilterBar({ showPeriod = true }: PaymentFilterBarProps) {
  const period = usePaymentPeriod();
  const setPeriod = usePaymentFiltersStore((state) => state.setPeriod);
  const categoryIds = usePaymentFiltersStore((state) => state.categoryIds);
  const setCategoryIds = usePaymentFiltersStore((state) => state.setCategoryIds);
  const clearCategories = usePaymentFiltersStore((state) => state.clearCategories);
  const resetToCurrentMonth = usePaymentFiltersStore(
    (state) => state.resetToCurrentMonth,
  );

  const isFiltered = categoryIds.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2.5 sm:px-6">
      {showPeriod && (
        <PaymentPeriodPicker
          from={period.from}
          to={period.to}
          onChange={setPeriod}
          hideTime
          triggerClassName="h-9"
        />
      )}

      <CategoryMultiSelect selectedIds={categoryIds} onChange={setCategoryIds} />

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-muted-foreground"
          onClick={() => {
            clearCategories();
            if (showPeriod) resetToCurrentMonth();
          }}
        >
          <RotateCcw className="size-3.5" />
          Limpar
        </Button>
      )}

      <p className="ml-auto hidden text-[11px] text-muted-foreground lg:block">
        Filtro compartilhado entre as abas
      </p>
    </div>
  );
}
