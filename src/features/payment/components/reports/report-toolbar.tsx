"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportRegime } from "../../hooks/use-payment-reports";

export function ReportToolbar({
  title,
  subtitle,
  regime,
  onRegimeChange,
}: {
  title: string;
  subtitle: string;
  regime: ReportRegime;
  onRegimeChange: (regime: ReportRegime) => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-bold tracking-tight">{title}</h2>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={regime}
          onValueChange={(value) => onRegimeChange(value as ReportRegime)}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Regime de caixa</SelectItem>
            <SelectItem value="accrual">Competência</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
