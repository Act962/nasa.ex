"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { useNasaRoutePendingSales, useNasaRouteSales } from "../../hooks/use-nasa-route-sales";

export type ConfirmedSale = NonNullable<ReturnType<typeof useNasaRouteSales>["data"]>["sales"][number];
export type PendingSale = NonNullable<ReturnType<typeof useNasaRoutePendingSales>["data"]>["pending"][number];

export const saleDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatBrl(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const SALE_SOURCE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  stripe_purchase: { label: "Stripe", variant: "default" },
  purchase: { label: "Stars", variant: "secondary" },
  free_access: { label: "Acesso grátis", variant: "outline" },
  gift: { label: "Presente", variant: "outline" },
};

export const PENDING_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Aguardando pagamento", className: "bg-warning/15 text-warning" },
  PAID: { label: "Pago — aguardando resgate", className: "bg-info/15 text-info" },
  EXPIRED: { label: "Link expirado", className: "bg-destructive/15 text-destructive" },
  CANCELLED: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
  REDEEMED: { label: "Resgatado", className: "bg-success/15 text-success" },
};

export function SalesTableHeaderCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-4 py-3 font-semibold", align === "right" ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

export function SalesEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function SalesCardsSkeleton() {
  return (
    <div className="space-y-2 md:hidden">
      {[1, 2, 3].map((placeholderIndex) => (
        <Skeleton key={placeholderIndex} className="h-24 rounded-[18px]" />
      ))}
    </div>
  );
}

const KPI_TONE_CLASS = {
  success: { card: "border-success/30 bg-success/10 text-success", icon: "bg-success" },
  info: { card: "border-info/30 bg-info/10 text-info", icon: "bg-info" },
  warning: { card: "border-warning/30 bg-warning/10 text-warning", icon: "bg-warning" },
} as const;

export function SalesKpiCard({
  icon,
  label,
  value,
  tone,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  tone: keyof typeof KPI_TONE_CLASS;
  className?: string;
}) {
  const toneClass = KPI_TONE_CLASS[tone];
  return (
    <div className={cn("rounded-[18px] border p-3 md:rounded-[20px] md:p-5", toneClass.card, className)}>
      <div className="flex items-center gap-2.5 md:gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-white md:size-10 [&_svg]:size-4 md:[&_svg]:size-5",
            toneClass.icon,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] opacity-80 md:text-xs md:tracking-wider md:uppercase">{label}</p>
          {value == null ? (
            <Skeleton className="mt-1 h-6 w-20 md:h-7 md:w-28" />
          ) : (
            <p className="truncate text-lg font-bold tabular-nums md:text-2xl">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
