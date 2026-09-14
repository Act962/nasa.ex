"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { useCashflowDay } from "../../hooks/use-payment";
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS } from "../../lib/format";

/**
 * Abre os lançamentos que compõem um dia do fluxo. O valor mostrado em cada
 * linha é o que entrou na soma daquele dia — pago quando liquidado, previsto
 * quando em aberto —, e não o total do lançamento, que pode diferir num
 * recebimento parcial.
 */
export function CashflowDayDialog({
  date,
  categoryIds,
  onClose,
}: {
  date: string | null;
  categoryIds?: string[];
  onClose: () => void;
}) {
  const { data, isLoading } = useCashflowDay({ date, categoryIds });
  const entries = data?.entries ?? [];

  return (
    <Dialog open={Boolean(date)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto scroll-cols-tracking">
        <DialogHeader>
          <DialogTitle>
            Movimentação de {date ? formatDate(date) : ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando...
          </div>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum lançamento neste dia.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-green-400">
                  <ArrowDownCircle className="size-3.5" />
                  <span className="text-xs font-medium">Entradas</span>
                </div>
                <p className="mt-0.5 text-lg font-black tabular-nums text-green-400">
                  {formatCurrency(data?.totals.receivable ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-red-400">
                  <ArrowUpCircle className="size-3.5" />
                  <span className="text-xs font-medium">Saídas</span>
                </div>
                <p className="mt-0.5 text-lg font-black tabular-nums text-red-400">
                  {formatCurrency(data?.totals.payable ?? 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {entries.map((entry) => {
                const isIn = entry.type === "RECEIVABLE";
                const color = isIn ? "text-green-400" : "text-red-400";
                const isPartial = entry.cashAmount !== entry.amount;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/40 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.contactName ?? "Sem contato"}
                        {entry.categoryName ? ` · ${entry.categoryName}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[entry.status] ?? ""}`}
                        >
                          {STATUS_LABELS[entry.status] ?? entry.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {entry.paidAt
                            ? `pago em ${formatDate(entry.paidAt)}`
                            : `vence ${formatDate(entry.dueDate)}`}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${color}`}>
                        {isIn ? "+" : "-"} {formatCurrency(entry.cashAmount)}
                      </p>
                      {isPartial && (
                        <p className="text-[10px] text-muted-foreground">
                          de {formatCurrency(entry.amount)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
