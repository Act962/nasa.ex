"use client";

import { CalendarIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/features/insights/types";

interface DashboardFiltersProps {
  trackingId: string;
  dateRange: DateRange;
  trackingOptions: { id: string; name: string }[];
  onTrackingChange: (id: string) => void;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DashboardFilters({
  trackingId,
  dateRange,
  trackingOptions,
  onTrackingChange,
  onDateRangeChange,
  onRefresh,
  isLoading = false,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={trackingId} onValueChange={onTrackingChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Selecione um tracking" />
          </SelectTrigger>
          <SelectContent>
            {trackingOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal sm:w-[280px]",
                !dateRange.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                "Selecione o período"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) =>
                onDateRangeChange({ from: range?.from, to: range?.to })
              }
              numberOfMonths={2}
            />
            <div className="flex items-center justify-between border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onDateRangeChange({ from: undefined, to: undefined })
                }
              >
                Limpar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const thirtyDaysAgo = new Date(now);
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    onDateRangeChange({ from: thirtyDaysAgo, to: now });
                  }}
                >
                  Últimos 30 dias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const ninetyDaysAgo = new Date(now);
                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                    onDateRangeChange({ from: ninetyDaysAgo, to: now });
                  }}
                >
                  Últimos 90 dias
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        className="self-end sm:self-auto"
      >
        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
      </Button>
    </div>
  );
}
