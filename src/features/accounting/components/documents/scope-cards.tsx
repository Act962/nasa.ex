"use client";

import { Building, Briefcase, FileSpreadsheet, Landmark, MapPinned, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRegularityScore } from "@/features/accounting/hooks/use-accounting-compliance";
import { DOCUMENT_SCOPE_LABELS, type DocumentScope } from "@/features/accounting/lib/compliance/document-catalog";
import { SCOPE_ORDER } from "./document-display";

const SCOPE_ICONS: Record<DocumentScope, LucideIcon> = {
  FEDERAL: Landmark,
  ESTADUAL: MapPinned,
  MUNICIPAL: Building,
  TRABALHISTA: Briefcase,
  SOCIETARIO: Scale,
  FISCAL_CONTABIL: FileSpreadsheet,
};

export function ScopeCards() {
  const { data: score, isLoading } = useRegularityScore();
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  const items = score?.items ?? [];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {SCOPE_ORDER.map((scope) => {
        const scopeItems = items.filter((item) => item.scope === scope);
        const okCount = scopeItems.filter((item) => item.status === "OK" || item.status === "EXPIRING_SOON").length;
        const isAllOk = scopeItems.length > 0 && okCount === scopeItems.length;
        const ScopeIcon = SCOPE_ICONS[scope];
        return (
          <Card key={scope} className="gap-0 py-0">
            <CardContent className="space-y-1 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ScopeIcon className="size-3.5" /> {DOCUMENT_SCOPE_LABELS[scope]}
              </div>
              {scopeItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada exigido</p>
              ) : (
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    isAllOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {okCount}/{scopeItems.length} <span className="text-xs font-normal text-muted-foreground">em dia</span>
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
