"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ConfirmedSale,
  SALE_SOURCE_LABEL,
  SalesCardsSkeleton,
  SalesEmptyState,
  SalesTableHeaderCell,
  formatBrl,
  saleDateFormatter,
} from "./sales-shared";

const EMPTY_MESSAGE = "Nenhuma venda confirmada ainda.";

function getSourceMeta(sale: ConfirmedSale) {
  return SALE_SOURCE_LABEL[sale.source] ?? { label: sale.source, variant: "outline" as const };
}

function SaleStatusBadge({ status }: { status: string }) {
  return status === "active" ? (
    <Badge className="bg-success/15 text-success">Ativa</Badge>
  ) : (
    <Badge variant="outline">Reembolsada</Badge>
  );
}

function StripePaymentLink({ sale }: { sale: ConfirmedSale }) {
  if (!sale.stripeCheckoutSessionId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <a
      href={`https://dashboard.stripe.com/payments/${sale.stripePaymentIntentId ?? ""}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      title={sale.stripeCheckoutSessionId}
    >
      Ver no Stripe
      <ExternalLink className="size-3" />
    </a>
  );
}

export function SalesConfirmedList({ sales, isLoading }: { sales: ConfirmedSale[]; isLoading: boolean }) {
  return (
    <>
      <div className="md:hidden">
        {isLoading ? (
          <SalesCardsSkeleton />
        ) : sales.length === 0 ? (
          <SalesEmptyState message={EMPTY_MESSAGE} />
        ) : (
          <ul className="space-y-2">
            {sales.map((sale) => (
              <li key={sale.id} className="rounded-[18px] border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{sale.user?.name ?? sale.user?.email ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sale.course.title}
                      {sale.plan?.name ? ` · ${sale.plan.name}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums">{formatBrl(sale.paidBrlCents)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{saleDateFormatter.format(new Date(sale.enrolledAt))}</span>
                  <Badge variant={getSourceMeta(sale).variant}>{getSourceMeta(sale).label}</Badge>
                  <SaleStatusBadge status={sale.status} />
                  {sale.paidStars > 0 && (
                    <span className="tabular-nums">+{sale.paidStars.toLocaleString("pt-BR")} ★</span>
                  )}
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
                <SalesTableHeaderCell>Data</SalesTableHeaderCell>
                <SalesTableHeaderCell>Comprador</SalesTableHeaderCell>
                <SalesTableHeaderCell>Curso / Plano</SalesTableHeaderCell>
                <SalesTableHeaderCell align="right">Valor (BRL)</SalesTableHeaderCell>
                <SalesTableHeaderCell align="right">Repasse (★)</SalesTableHeaderCell>
                <SalesTableHeaderCell>Origem</SalesTableHeaderCell>
                <SalesTableHeaderCell>Stripe</SalesTableHeaderCell>
                <SalesTableHeaderCell>Status</SalesTableHeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 5 }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="px-4 py-3" colSpan={8}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : sales.map((sale) => {
                    const sourceMeta = getSourceMeta(sale);
                    return (
                      <tr key={sale.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {saleDateFormatter.format(new Date(sale.enrolledAt))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{sale.user?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{sale.user?.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{sale.course.title}</div>
                          {sale.plan?.name && (
                            <div className="text-xs text-muted-foreground">{sale.plan.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatBrl(sale.paidBrlCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                          {sale.paidStars > 0 ? `+${sale.paidStars.toLocaleString("pt-BR")} ★` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={sourceMeta.variant}>{sourceMeta.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <StripePaymentLink sale={sale} />
                        </td>
                        <td className="px-4 py-3">
                          <SaleStatusBadge status={sale.status} />
                        </td>
                      </tr>
                    );
                  })}
              {!isLoading && sales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
