"use client";

import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDocumentDate } from "./document-display";
import type { CompanyDocumentRowView } from "./document-row-types";

const WINDOWS = [
  { maxDays: 30, label: "Próximos 30 dias", className: "border-destructive/40 bg-destructive/5" },
  { maxDays: 60, label: "31 a 60 dias", className: "border-warning/40 bg-warning/5" },
  { maxDays: 90, label: "61 a 90 dias", className: "border-info/30 bg-info/5" },
];

export function ExpiryTimeline({ documents }: { documents: CompanyDocumentRowView[] }) {
  const upcoming = documents
    .filter(
      (document) =>
        document.displayStatus !== "REPLACED" &&
        document.daysToExpire !== null &&
        document.daysToExpire >= 0 &&
        document.daysToExpire <= 90,
    )
    .sort((left, right) => (left.daysToExpire ?? 0) - (right.daysToExpire ?? 0));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-info" /> Vencimentos nos próximos 90 dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nada vence nos próximos 90 dias. Envie documentos com a data de validade para acompanhar aqui.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {WINDOWS.map((window, windowIndex) => {
              const minDays = windowIndex === 0 ? 0 : WINDOWS[windowIndex - 1].maxDays + 1;
              const windowDocuments = upcoming.filter(
                (document) => (document.daysToExpire ?? 0) >= minDays && (document.daysToExpire ?? 0) <= window.maxDays,
              );
              return (
                <div key={window.label} className={cn("rounded-xl border p-3", window.className)}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {window.label} · {windowDocuments.length}
                  </p>
                  {windowDocuments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum vencimento.</p>
                  ) : (
                    <ul className="space-y-2">
                      {windowDocuments.map((document) => (
                        <li key={document.id} className="text-sm">
                          <p className="font-medium leading-snug">{document.typeLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDocumentDate(document.effectiveExpiresAt)} · em {document.daysToExpire}{" "}
                            {document.daysToExpire === 1 ? "dia" : "dias"}
                            {document.isExpiryEstimated && " (estimado)"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
