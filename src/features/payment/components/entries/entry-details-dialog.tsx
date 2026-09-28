"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EntryAttachmentsSection } from "../attachments/entry-attachments-section";
import { RemindersPanel } from "../reminders/reminders-panel";
import {
  formatCurrency,
  formatDate,
  formatTimestampDate,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../../lib/format";

interface DetailsEntry {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: Date | string;
  paidAt: Date | string | null;
  competenceDate: Date | string | null;
  documentNumber: string | null;
  notes: string | null;
  installmentTotal: number | null;
  installmentCurrent: number | null;
  category: { name: string } | null;
  contact: { name: string } | null;
  account: { name: string } | null;
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

export function EntryDetailsDialog({
  entry,
  onOpenChange,
}: {
  entry: DetailsEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  const isReceivable = entry.type === "RECEIVABLE";
  const color = isReceivable ? "text-green-400" : "text-red-400";
  const restante = entry.amount - entry.paidAmount;

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scroll-cols-tracking">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-left">
            <span className={`text-base ${color}`}>{isReceivable ? "💚" : "🔴"}</span>
            <span className="min-w-0 break-words">{entry.description}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-2xl font-black tabular-nums ${color}`}>
              {formatCurrency(entry.amount)}
            </p>
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[entry.status]}`}>
              {STATUS_LABELS[entry.status] ?? entry.status}
            </Badge>
          </div>

          {entry.paidAmount > 0 && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isReceivable ? "Recebido" : "Pago"}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(entry.paidAmount)}
                </span>
              </div>
              {restante > 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Restante</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(restante)}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Campo rotulo="Vencimento">{formatDate(entry.dueDate)}</Campo>
            <Campo rotulo={isReceivable ? "Recebimento" : "Pagamento"}>
              {entry.paidAt ? formatTimestampDate(entry.paidAt) : "—"}
            </Campo>
            <Campo rotulo="Categoria">{entry.category?.name ?? "—"}</Campo>
            <Campo rotulo={isReceivable ? "Cliente" : "Fornecedor"}>
              {entry.contact?.name ?? "—"}
            </Campo>
            <Campo rotulo="Conta bancária">{entry.account?.name ?? "—"}</Campo>
            <Campo rotulo="Nº do documento">{entry.documentNumber ?? "—"}</Campo>
            {entry.competenceDate && (
              <Campo rotulo="Competência">{formatDate(entry.competenceDate)}</Campo>
            )}
            {entry.installmentTotal && (
              <Campo rotulo="Parcela">
                {entry.installmentCurrent}/{entry.installmentTotal}
              </Campo>
            )}
          </div>

          {entry.notes && (
            <>
              <Separator />
              <Campo rotulo="Observações">
                <p className="whitespace-pre-wrap text-muted-foreground">{entry.notes}</p>
              </Campo>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Comprovantes
            </p>
            <EntryAttachmentsSection entryId={entry.id} />
          </div>

          <Separator />

          <RemindersPanel entryId={entry.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
