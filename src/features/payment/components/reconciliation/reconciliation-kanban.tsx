"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "../../lib/format";
import { describePaymentError } from "../../lib/describe-error";
import {
  useIgnoreTransaction,
  useReconcileTransaction,
  useStatementTransactions,
  useUnmatchTransaction,
} from "../../hooks/use-payment-statements";
import type { StatementTransactionRow } from "./transactions-list";

type StatusKey = "PENDING" | "MATCHED" | "IGNORED";

const COLUMNS: Array<{ key: StatusKey; label: string; hint: string }> = [
  { key: "PENDING", label: "A conciliar", hint: "Arraste para Ignoradas, ou para Conciliadas quando houver sugestão" },
  { key: "MATCHED", label: "Conciliadas", hint: "Arraste de volta para A conciliar pra desfazer" },
  { key: "IGNORED", label: "Ignoradas", hint: "Arraste de volta para A conciliar pra restaurar" },
];

export function ReconciliationKanban({ accountId }: { accountId?: string }) {
  const pending = useStatementTransactions({ accountId, status: "PENDING" });
  const matched = useStatementTransactions({ accountId, status: "MATCHED" });
  const ignored = useStatementTransactions({ accountId, status: "IGNORED" });

  const reconcile = useReconcileTransaction();
  const unmatch = useUnmatchTransaction();
  const ignore = useIgnoreTransaction();

  const [activeCard, setActiveCard] = useState<StatementTransactionRow | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const byStatus: Record<StatusKey, StatementTransactionRow[]> = {
    PENDING: (pending.data?.transactions ?? []) as StatementTransactionRow[],
    MATCHED: (matched.data?.transactions ?? []) as StatementTransactionRow[],
    IGNORED: (ignored.data?.transactions ?? []) as StatementTransactionRow[],
  };

  function findCard(id: string): StatementTransactionRow | null {
    for (const key of Object.keys(byStatus) as StatusKey[]) {
      const found = byStatus[key].find((transaction) => transaction.id === id);
      if (found) return found;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCard(findCard(String(event.active.id)));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;
    const card = findCard(String(active.id));
    if (!card) return;
    const from = card.status as StatusKey;
    const to = over.id as StatusKey;
    if (from === to) return;

    try {
      if (to === "IGNORED") {
        await ignore.mutateAsync({ transactionId: card.id });
        toast.success("Transação ignorada");
        return;
      }
      if (to === "PENDING") {
        if (from === "IGNORED") {
          await ignore.mutateAsync({ transactionId: card.id, undo: true });
          toast.success("Transação devolvida à fila");
        } else if (from === "MATCHED") {
          await unmatch.mutateAsync({ transactionId: card.id });
          toast.success("Conciliação desfeita");
        }
        return;
      }
      if (to === "MATCHED") {
        if (from === "PENDING" && card.suggestion) {
          await reconcile.mutateAsync({ transactionId: card.id, entryId: card.suggestion.entryId });
          toast.success("Conciliado com a sugestão");
        } else {
          toast.info("Sem sugestão automática — use a Lista para escolher o lançamento.");
        }
      }
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível mover a transação"));
    }
  }

  const isLoading = pending.isLoading || matched.isLoading || ignored.isLoading;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.key}
            column={column}
            transactions={byStatus[column.key]}
            isLoading={isLoading}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <TransactionCard transaction={activeCard} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  transactions,
  isLoading,
}: {
  column: { key: StatusKey; label: string; hint: string };
  transactions: StatementTransactionRow[];
  isLoading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-64 flex-col rounded-xl border p-2.5 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border/50 bg-muted/10"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{column.label}</span>
        <Badge variant="outline" className="text-[10px]">{transactions.length}</Badge>
      </div>
      <div className="flex-1 space-y-2">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
        ) : transactions.length === 0 ? (
          <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">{column.hint}</p>
        ) : (
          transactions.map((transaction) => (
            <DraggableCard key={transaction.id} transaction={transaction} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({ transaction }: { transaction: StatementTransactionRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: transaction.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <TransactionCard transaction={transaction} />
    </div>
  );
}

function TransactionCard({
  transaction,
  dragging,
}: {
  transaction: StatementTransactionRow;
  dragging?: boolean;
}) {
  const isCredit = transaction.direction === "CREDIT";
  const color = isCredit ? "text-green-400" : "text-red-400";
  const Icon = isCredit ? ArrowDownCircle : ArrowUpCircle;
  return (
    <div
      className={`rounded-lg border border-border/50 bg-card p-2.5 ${
        dragging ? "shadow-lg ring-1 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-bold tabular-nums ${color}`}>
              {formatCurrency(transaction.amountCents)}
            </p>
            {transaction.reviewedAt && (
              <CheckCircle2 className="size-3.5 text-emerald-500" aria-label="Conferido" />
            )}
            {transaction.comprovanteAttachmentId && (
              <FileText className="size-3.5 text-muted-foreground" aria-label="Tem comprovante" />
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {formatDate(transaction.postedDate)}
            {transaction.counterpartyName ? ` · ${transaction.counterpartyName}` : ""}
          </p>
          {transaction.status === "PENDING" && transaction.suggestion && (
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-blue-400">
              <Sparkles className="size-3 shrink-0" />
              {transaction.suggestion.entry.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
