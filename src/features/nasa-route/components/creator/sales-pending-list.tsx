"use client";

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  PENDING_STATUS_LABEL,
  type PendingSale,
  SalesCardsSkeleton,
  SalesEmptyState,
  SalesTableHeaderCell,
  formatBrl,
  saleDateFormatter,
} from "./sales-shared";

const EMPTY_MESSAGE = "Nenhuma compra pendente.";

function getStatusMeta(pendingSale: PendingSale) {
  return (
    PENDING_STATUS_LABEL[pendingSale.status] ?? {
      label: pendingSale.status,
      className: "bg-muted text-muted-foreground",
    }
  );
}

function PendingStatusChip({ pendingSale }: { pendingSale: PendingSale }) {
  const statusMeta = getStatusMeta(pendingSale);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusMeta.className)}>
      {statusMeta.label}
    </span>
  );
}

function getFlowLabel(pendingSale: PendingSale) {
  return pendingSale.flow === "authenticated" ? "Com conta" : "Página pública";
}

export function SalesPendingList({ pending, isLoading }: { pending: PendingSale[]; isLoading: boolean }) {
  return (
    <>
      <div className="md:hidden">
        {isLoading ? (
          <SalesCardsSkeleton />
        ) : pending.length === 0 ? (
          <SalesEmptyState message={EMPTY_MESSAGE} />
        ) : (
          <ul className="space-y-2">
            {pending.map((pendingSale) => (
              <li key={pendingSale.id} className="rounded-[18px] border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{pendingSale.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pendingSale.course.title}
                      {pendingSale.plan?.name ? ` · ${pendingSale.plan.name}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums">{formatBrl(pendingSale.amountBrlCents)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PendingStatusChip pendingSale={pendingSale} />
                  <span className="tabular-nums">{saleDateFormatter.format(new Date(pendingSale.createdAt))}</span>
                  <span>· {getFlowLabel(pendingSale)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-[20px] border border-line bg-card max-md:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-muted/50">
              <tr>
                <SalesTableHeaderCell>Iniciado em</SalesTableHeaderCell>
                <SalesTableHeaderCell>Email</SalesTableHeaderCell>
                <SalesTableHeaderCell>Curso / Plano</SalesTableHeaderCell>
                <SalesTableHeaderCell align="right">Valor</SalesTableHeaderCell>
                <SalesTableHeaderCell>Fluxo</SalesTableHeaderCell>
                <SalesTableHeaderCell>Status</SalesTableHeaderCell>
                <SalesTableHeaderCell>Expira</SalesTableHeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 5 }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="px-4 py-3" colSpan={7}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : pending.map((pendingSale) => (
                    <tr key={pendingSale.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {saleDateFormatter.format(new Date(pendingSale.createdAt))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{pendingSale.email}</div>
                        {pendingSale.user?.name && (
                          <div className="text-xs text-muted-foreground">{pendingSale.user.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{pendingSale.course.title}</div>
                        {pendingSale.plan?.name && (
                          <div className="text-xs text-muted-foreground">{pendingSale.plan.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatBrl(pendingSale.amountBrlCents)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{getFlowLabel(pendingSale)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <PendingStatusChip pendingSale={pendingSale} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {pendingSale.tokenExpiresAt ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {saleDateFormatter.format(new Date(pendingSale.tokenExpiresAt))}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
              {!isLoading && pending.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {EMPTY_MESSAGE}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
