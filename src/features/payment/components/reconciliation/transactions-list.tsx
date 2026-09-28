"use client";

import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  CheckCircle2,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "../../lib/format";
import { describePaymentError } from "../../lib/describe-error";
import {
  useIgnoreTransaction,
  useMarkTransactionReviewed,
  useReconcileTransaction,
  useReviewTransactionWithAstro,
  useUnmatchTransaction,
} from "../../hooks/use-payment-statements";
import { CreateEntryDialog } from "./create-entry-dialog";

type ReviewFieldStatus = "match" | "divergent" | "unknown";
export interface TransactionReviewResult {
  checkedAt: string;
  attachmentId: string;
  matches: boolean;
  payer: { status: ReviewFieldStatus; expected: string | null; found: string | null };
  amount: { status: ReviewFieldStatus; expectedCents: number; foundCents: number | null };
  date: { status: ReviewFieldStatus; expected: string | null; found: string | null };
  warnings: string[];
}

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
  source?: string;
  matchedEntryId?: string | null;
  reviewedAt?: Date | string | null;
  reviewResult?: TransactionReviewResult | null;
  comprovanteAttachmentId?: string | null;
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
  const markReviewed = useMarkTransactionReviewed();
  const reviewWithAstro = useReviewTransactionWithAstro();
  const [astroBusyId, setAstroBusyId] = useState<string | null>(null);

  async function handleAstroReview(transaction: StatementTransactionRow) {
    setAstroBusyId(transaction.id);
    try {
      const result = await reviewWithAstro.mutateAsync({ transactionId: transaction.id });
      if (result.review.matches) {
        toast.success("Astro conferiu: pagador, valor e data batem com o comprovante.");
      } else {
        const diverging = [
          result.review.payer.status === "divergent" ? "pagador" : null,
          result.review.amount.status === "divergent" ? "valor" : null,
          result.review.date.status === "divergent" ? "data" : null,
        ].filter(Boolean);
        toast.warning(
          diverging.length > 0
            ? `Astro achou divergência em: ${diverging.join(", ")}.`
            : "Astro leu o comprovante, mas não confirmou todos os campos.",
        );
      }
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível ler o comprovante"));
    } finally {
      setAstroBusyId(null);
    }
  }

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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className={`text-base font-bold tabular-nums ${color}`}>
                        {formatCurrency(transaction.amountCents)}
                      </p>
                      {transaction.source === "PDF_UPLOAD" && (
                        <Badge
                          variant="outline"
                          className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300"
                          title="Transação lida por IA de um extrato em PDF"
                        >
                          PDF
                        </Badge>
                      )}
                    </div>
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
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {transaction.comprovanteAttachmentId && (
                      <a
                        href={`/api/payment/attachments/${transaction.comprovanteAttachmentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir comprovante anexado"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      >
                        <FileText className="size-3.5" />
                        Comprovante
                      </a>
                    )}
                    {transaction.comprovanteAttachmentId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        disabled={astroBusyId === transaction.id}
                        onClick={() => void handleAstroReview(transaction)}
                        title="Ler o comprovante com o Astro e conferir pagador × valor × data"
                      >
                        {astroBusyId === transaction.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5 text-violet-400" />
                        )}
                        Conferir com Astro
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={transaction.reviewedAt ? "secondary" : "outline"}
                      className="h-8 gap-1.5 text-xs"
                      disabled={markReviewed.isPending}
                      onClick={() =>
                        void run(
                          markReviewed.mutateAsync({
                            transactionId: transaction.id,
                            reviewed: !transaction.reviewedAt,
                          }),
                          transaction.reviewedAt ? "Marcação removida" : "Marcado como conferido",
                          "Não foi possível atualizar",
                        )
                      }
                    >
                      <CheckCircle2
                        className={`size-3.5 ${transaction.reviewedAt ? "text-emerald-500" : ""}`}
                      />
                      {transaction.reviewedAt ? "Conferido" : "Conferir"}
                    </Button>
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
                  </div>
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

              {status === "MATCHED" && transaction.reviewResult && (
                <ReviewVerdict review={transaction.reviewResult} />
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

function ReviewVerdict({ review }: { review: TransactionReviewResult }) {
  const rows: Array<{ label: string; status: ReviewFieldStatus; detail: string }> = [
    {
      label: "Pagador",
      status: review.payer.status,
      detail: review.payer.found ?? review.payer.expected ?? "—",
    },
    {
      label: "Valor",
      status: review.amount.status,
      detail:
        review.amount.foundCents !== null
          ? formatCurrency(review.amount.foundCents)
          : "não lido",
    },
    {
      label: "Data",
      status: review.date.status,
      detail: review.date.found ?? review.date.expected ?? "—",
    },
  ];
  const tone = review.matches
    ? "border-emerald-500/25 bg-emerald-500/5"
    : "border-amber-500/25 bg-amber-500/5";

  return (
    <div className={`mt-2.5 rounded-lg border p-2.5 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-violet-400" />
        <p className="text-[11px] font-medium">
          {review.matches
            ? "Astro conferiu o comprovante — tudo bate"
            : "Astro leu o comprovante — confira as divergências"}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((row) => (
          <span key={row.label} className="inline-flex items-center gap-1 text-[11px]">
            {row.status === "match" ? (
              <Check className="size-3 text-emerald-500" />
            ) : row.status === "divergent" ? (
              <TriangleAlert className="size-3 text-amber-500" />
            ) : (
              <span className="text-muted-foreground">?</span>
            )}
            <span className="text-muted-foreground">{row.label}:</span>
            <span className="truncate max-w-[160px]">{row.detail}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
