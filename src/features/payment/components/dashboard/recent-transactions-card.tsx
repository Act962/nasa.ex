"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeDateTime } from "../../lib/format";
import type { RecentTransaction } from "./types";

export function RecentTransactionsCard({
  transactions,
  onSeeAll,
}: {
  transactions: RecentTransaction[];
  onSeeAll: () => void;
}) {
  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 sm:p-5">
        <CardTitle className="min-w-0 truncate text-base font-semibold">
          Últimas Transações
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0">
        {transactions.length === 0 ? (
          <p className="flex-1 px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
            Nenhum pagamento registrado ainda.
          </p>
        ) : (
          <ul className="flex-1 divide-y">
            {transactions.map((transaction) => {
              const isInflow = transaction.type === "RECEIVABLE";
              return (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      isInflow
                        ? "bg-success/10 text-success dark:bg-success/15 dark:text-success"
                        : "bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive",
                    )}
                  >
                    {isInflow ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      title={transaction.description}
                    >
                      {transaction.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {transaction.contactName ?? "Sem contato vinculado"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isInflow
                          ? "text-success dark:text-success"
                          : "text-destructive dark:text-destructive",
                      )}
                    >
                      {isInflow ? "+ " : "- "}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelativeDateTime(transaction.occurredAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-1.5 text-xs text-info hover:text-info dark:text-info"
            onClick={onSeeAll}
          >
            Ver todas as transações
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
