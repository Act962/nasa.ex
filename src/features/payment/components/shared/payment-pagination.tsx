"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Paginação compartilhada pelas listas do módulo financeiro (Receita, Despesa,
// Contatos, Contratos, Documentos). Antes cada aba carregava só a primeira
// página e não oferecia como chegar no resto.
//
// São dois componentes de propósito: a navegação aparece também no topo das
// listas, junto dos filtros, pra não obrigar a rolar até o rodapé pra trocar
// de página. Os dois usam o mesmo `PaymentPaginationNav` — o botão do topo e o
// do rodapé não podem divergir.

export const PAYMENT_PAGE_SIZE = 25;
export const PAYMENT_SEARCH_DEBOUNCE_MS = 400;

interface PaginationState {
  page: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function totalPagesOf(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Só os controles de navegação. Renderiza `null` com uma única página — no
 * topo, ao lado dos filtros, setas desabilitadas seriam ruído permanente.
 */
export function PaymentPaginationNav({
  page,
  total,
  perPage,
  onPageChange,
  isLoading = false,
  className,
}: PaginationState & { className?: string }) {
  const totalPages = totalPagesOf(total, perPage);
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 px-2.5"
        disabled={page <= 1 || isLoading}
        onClick={() => onPageChange(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="size-4" />
        Anterior
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 px-2.5"
        disabled={page >= totalPages || isLoading}
        onClick={() => onPageChange(page + 1)}
        aria-label="Próxima página"
      >
        Próxima
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

interface PaymentPaginationProps extends PaginationState {
  /** Nome do que está sendo listado, no singular (ex.: "lançamento"). */
  itemLabel?: string;
  itemLabelPlural?: string;
}

/** Rodapé completo: intervalo exibido + navegação. */
export function PaymentPagination({
  page,
  total,
  perPage,
  onPageChange,
  itemLabel = "registro",
  itemLabelPlural,
  isLoading = false,
}: PaymentPaginationProps) {
  const plural = itemLabelPlural ?? `${itemLabel}s`;
  const firstOfPage = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastOfPage = Math.min(page * perPage, total);

  if (total === 0 && !isLoading) return null;

  return (
    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {isLoading ? (
          "Carregando…"
        ) : (
          <>
            Mostrando <span className="font-medium text-foreground">{firstOfPage}</span>
            –<span className="font-medium text-foreground">{lastOfPage}</span> de{" "}
            <span className="font-medium text-foreground">{total}</span>{" "}
            {total === 1 ? itemLabel : plural}
          </>
        )}
      </p>

      <PaymentPaginationNav
        page={page}
        total={total}
        perPage={perPage}
        onPageChange={onPageChange}
        isLoading={isLoading}
      />
    </div>
  );
}
