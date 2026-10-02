import { OrbitaSpinner } from "@/components/orbita-spinner";
import type { ReactNode } from "react";

// Moldura comum das listas da lateral: carregando, vazio e itens.

export function ScreenList({
  isLoading,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <OrbitaSpinner className="size-5 text-muted-foreground" />
      </div>
    );
  }
  if (isEmpty) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

export function ScreenRow({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {badge}
    </li>
  );
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
