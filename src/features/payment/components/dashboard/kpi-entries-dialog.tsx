"use client";

/**
 * Dialog acionado pelo ícone "lista" em cada KpiCard do dashboard. Carrega
 * lentamente (só busca quando abre) e mostra as entries que compõem o KPI
 * clicado. Cada linha tem checkbox; o rodapé mostra a soma dos selecionados.
 *
 * O caller passa um `filter` que replica as regras de negócio do KPI
 * (ex.: "A Receber" = type=RECEIVABLE + statuses [PENDING,PARTIAL,OVERDUE] +
 * dueDate no intervalo do mês).
 */

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { usePaymentEntries } from "../../hooks/use-payment";
import { formatCurrency } from "../../lib/format";

type EntryStatus =
  | "PENDING_APPROVAL"
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type KpiEntriesFilter = {
  type?: "RECEIVABLE" | "PAYABLE";
  statuses?: EntryStatus[];
  dateFrom?: string;
  dateTo?: string;
  paidFrom?: string;
  paidTo?: string;
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  PENDING_APPROVAL: "Aprovação",
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

const STATUS_CLASSES: Record<EntryStatus, string> = {
  PENDING_APPROVAL: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  PENDING: "text-zinc-400 border-zinc-400/30 bg-zinc-400/10",
  PARTIAL: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  PAID: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  OVERDUE: "text-red-400 border-red-400/30 bg-red-400/10",
  CANCELLED: "text-zinc-500 border-zinc-500/30 bg-zinc-500/10",
};

export function KpiEntriesDialog({
  open,
  onOpenChange,
  title,
  filter,
  // Cor do totalizador — combina com a cor do KPI que abriu o dialog
  accentClassName = "text-[#1E90FF]",
  // Quando true, considera o valor "paidAmount" na soma (usado nos KPIs de
  // "Recebido"/"Pago" — o valor efetivamente realizado, não o total do
  // lançamento). Default: soma o total.
  useSumOfPaid = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  filter: KpiEntriesFilter;
  accentClassName?: string;
  useSumOfPaid?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = usePaymentEntries({
    ...filter,
    perPage: 200,
    enabled: open,
  });

  const entries = data?.entries ?? [];

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === entries.length ? new Set() : new Set(entries.map((entry) => entry.id)),
    );
  }

  function toggleOne(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  const selectedSum = useMemo(() => {
    return entries
      .filter((entry) => selectedIds.has(entry.id))
      .reduce(
        (acc, entry) => acc + (useSumOfPaid ? entry.paidAmount : entry.amount),
        0,
      );
  }, [entries, selectedIds, useSumOfPaid]);

  const totalSum = useMemo(() => {
    return entries.reduce(
      (acc, entry) => acc + (useSumOfPaid ? entry.paidAmount : entry.amount),
      0,
    );
  }, [entries, useSumOfPaid]);

  const allSelected = entries.length > 0 && selectedIds.size === entries.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setSelectedIds(new Set());
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{title}</span>
            <Badge variant="outline" className="text-[10px]">
              {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0 z-10">
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todas"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-left font-medium">Contato</th>
                <th className="px-3 py-2 text-left font-medium">Vencimento</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin inline mr-2" />
                    Carregando lançamentos…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                    Nenhum lançamento encontrado nesse filtro.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const status = entry.status as EntryStatus;
                  const displayValue = useSumOfPaid ? entry.paidAmount : entry.amount;
                  const checked = selectedIds.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                      onClick={() => toggleOne(entry.id, !checked)}
                    >
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleOne(entry.id, value === true)
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{entry.description}</p>
                        {entry.installmentTotal && entry.installmentCurrent && (
                          <p className="text-[10px] text-muted-foreground">
                            {entry.installmentCurrent}/{entry.installmentTotal}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[160px]">
                        {entry.contact?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(entry.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={STATUS_CLASSES[status]}>
                          {STATUS_LABELS[status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatCurrency(displayValue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 px-1 pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground">
            Total do filtro:{" "}
            <span className="font-mono tabular-nums">{formatCurrency(totalSum)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Selecionados: </span>
              <span className="font-medium">{selectedIds.size}</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className={`font-bold font-mono tabular-nums ${accentClassName}`}>
                {formatCurrency(selectedSum)}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 text-xs gap-1"
              >
                <X className="size-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
