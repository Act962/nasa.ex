"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "../../lib/format";
import { KpiEntriesDialog, type KpiEntriesFilter } from "./kpi-entries-dialog";
import { TONE_CLASSES, type DashboardTone, type PreviewEntry } from "./types";

type UpcomingShortcut = {
  label: string;
  value: number;
  filter: KpiEntriesFilter;
};

export function EntriesPreviewCard({
  title,
  tone,
  entries,
  total,
  totalLabel,
  emptyMessage,
  onSeeAll,
  upcoming,
}: {
  title: string;
  tone: DashboardTone;
  entries: PreviewEntry[];
  total: number;
  totalLabel: string;
  emptyMessage: string;
  onSeeAll: () => void;
  upcoming: UpcomingShortcut;
}) {
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const toneClasses = TONE_CLASSES[tone];

  return (
    <>
      <Card className="flex h-full flex-col gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b p-4 sm:p-5">
          <CardTitle className="min-w-0 truncate text-base font-semibold">
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-0.5 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            onClick={onSeeAll}
          >
            Ver todas
            <ChevronRight className="size-3.5" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0">
          <button
            type="button"
            onClick={() => setUpcomingOpen(true)}
            className="flex items-center gap-2 border-b px-4 py-2.5 text-left text-xs transition-colors hover:bg-muted/60 sm:px-5"
          >
            <Clock className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {upcoming.label}
            </span>
            <span className={cn("shrink-0 font-semibold tabular-nums", toneClasses.value)}>
              {formatCurrency(upcoming.value)}
            </span>
          </button>

          {entries.length === 0 ? (
            <p className="flex-1 px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
              {emptyMessage}
            </p>
          ) : (
            <ul className="flex-1 divide-y">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      toneClasses.iconWrap,
                    )}
                  >
                    <Receipt className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      title={entry.description}
                    >
                      {entry.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.contactName ??
                        entry.categoryName ??
                        "Sem contato vinculado"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(entry.amount)}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] tabular-nums",
                        entry.status === "OVERDUE"
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {entry.status === "OVERDUE" ? "Venceu " : "Venc. "}
                      {formatDate(entry.dueDate)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
            <span className="truncate text-sm font-medium">{totalLabel}</span>
            <span
              className={cn(
                "shrink-0 text-sm font-bold tabular-nums",
                toneClasses.value,
              )}
            >
              {formatCurrency(total)}
            </span>
          </div>
        </CardContent>
      </Card>

      <KpiEntriesDialog
        open={upcomingOpen}
        onOpenChange={setUpcomingOpen}
        title={upcoming.label}
        filter={upcoming.filter}
        accentClassName={toneClasses.value}
      />
    </>
  );
}
