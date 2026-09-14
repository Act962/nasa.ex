"use client";

import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  EyeOff,
  Plus,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "../../lib/format";
import { describePaymentError } from "../../lib/describe-error";
import {
  useIgnoreTransaction,
  useReconcileTransaction,
  useUnmatchTransaction,
} from "../../hooks/use-payment-statements";
import { CreateEntryDialog } from "./create-entry-dialog";

interface Suggestion {
  entryId: string;
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
  isAmbiguous: boolean;
  entry: {
    id: string;
    description: string;
    amount: number;
    paidAmount: number;
    dueDate: Date | string;
    type: "RECEIVABLE" | "PAYABLE";
    contactName: string | null;
  };
}

export interface StatementTransactionRow {
  id: string;
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  postedDate: Date | string;
  memo: string;
  counterpartyName: string | null;
  status: "PENDING" | "MATCHED" | "IGNORED";
  ignoredReason: string | null;
  suggestion: Suggestion | null;
}

export function TransactionsList({
  transactions,
  status,
}: {
  transactions: StatementTransactionRow[];
  status: "PENDING" | "MATCHED" | "IGNORED";
}) {
  const [creatingFor, setCreatingFor] = useState<StatementTransactionRow | null>(null);
  const reconcile = useReconcileTransaction();
  const unmatch = useUnmatchTransaction();
  const ignore = useIgnoreTransaction();

  async function run(action: Promise<unknown>, success: string, fallback: string) {
    try {
      await action;
      toast.success(success);
    } catch (error) {
      toast.error(describePaymentError(error, fallback));
    }
  }

  return (
    <>
      <div className="space-y-2">
        {transactions.map((transaction) => {
          const isCredit = transaction.direction === "CREDIT";
          const color = isCredit ? "text-green-400" : "text-red-400";
          const Icon = isCredit ? ArrowDownCircle : ArrowUpCircle;
          const suggestion = transaction.suggestion;

          return (
            <div
              key={transaction.id}
              className="rounded-xl border border-border/50 bg-card p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <p className={`text-base font-bold tabular-nums ${color}`}>
                      {formatCurrency(transaction.amountCents)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(transaction.postedDate)}
                      {transaction.counterpartyName ? ` · ${transaction.counterpartyName}` : ""}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {transaction.memo}
                    </p>
                  </div>
                </div>

                {status === "PENDING" && (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setCreatingFor(transaction)}
                    >
                      <Plus className="size-3.5" />
                      Criar lançamento
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs text-muted-foreground"
                      disabled={ignore.isPending}
                      onClick={() =>
                        void run(
                          ignore.mutateAsync({ transactionId: transaction.id }),
                          "Transação ignorada",
                          "Não foi possível ignorar",
                        )
                      }
                    >
                      <EyeOff className="size-3.5" />
                      Ignorar
                    </Button>
                  </div>
                )}

                {status === "MATCHED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    disabled={unmatch.isPending}
                    onClick={() =>
                      void run(
                        unmatch.mutateAsync({ transactionId: transaction.id }),
                        "Conciliação desfeita",
                        "Não foi possível desfazer",
                      )
                    }
                  >
                    <RotateCcw className="size-3.5" />
                    Desfazer
                  </Button>
                )}

                {status === "IGNORED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    disabled={ignore.isPending}
                    onClick={() =>
                      void run(
                        ignore.mutateAsync({ transactionId: transaction.id, undo: true }),
                        "Transação devolvida à fila",
                        "Não foi possível restaurar",
                      )
                    }
                  >
                    <RotateCcw className="size-3.5" />
                    Restaurar
                  </Button>
                )}
              </div>

              {status === "PENDING" && suggestion && (
                <div className="mt-2.5 rounded-lg border border-blue-500/25 bg-blue-500/5 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium">
                          {suggestion.entry.description}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          vence {formatDate(suggestion.entry.dueDate)}
                        </Badge>
                        {suggestion.isAmbiguous && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400"
                          >
                            <TriangleAlert className="size-3" />
                            outro lançamento parecido
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {suggestion.reasons.join(" · ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-600/90"
                      disabled={reconcile.isPending}
                      onClick={() =>
                        void run(
                          reconcile.mutateAsync({
                            transactionId: transaction.id,
                            entryId: suggestion.entryId,
                          }),
                          "Conciliado",
                          "Não foi possível conciliar",
                        )
                      }
                    >
                      <Check className="size-3.5" />
                      Conciliar
                    </Button>
                  </div>
                </div>
              )}

              {status === "IGNORED" && transaction.ignoredReason && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Motivo: {transaction.ignoredReason}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <CreateEntryDialog
        transaction={creatingFor}
        onClose={() => setCreatingFor(null)}
      />
    </>
  );
}
