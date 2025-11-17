"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useSearchLead } from "@/hooks/use-search-lead";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Search } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { useDebouncedValue } from "@/hooks/use-debouced";
import { Skeleton } from "../ui/skeleton";

const ITEMS_PER_PAGE = 6;

export function SearchLeadModal() {
  const params = useParams<{ trackingId: string }>();
  const trigger = useSearchLead();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 200);

  // Reset para página 1 quando a busca mudar
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const { data, isLoading } = useSuspenseQuery(
    orpc.leads.list.queryOptions({
      input: {
        search: debouncedSearch,
        trackingId: params.trackingId,
        limit: ITEMS_PER_PAGE,
        page: currentPage,
      },
    })
  );

  // Gera números de página visíveis de forma inteligente
  const pageNumbers = useMemo(() => {
    const { totalPages } = data;
    const delta = 2; // Quantidade de páginas antes e depois da atual
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      // Se tiver 7 ou menos páginas, mostra todas
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Sempre mostra primeira página
    pages.push(1);

    // Calcula range de páginas ao redor da atual
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    // Adiciona ellipsis antes se necessário
    if (rangeStart > 2) {
      pages.push("ellipsis");
    }

    // Adiciona páginas do range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    // Adiciona ellipsis depois se necessário
    if (rangeEnd < totalPages - 1) {
      pages.push("ellipsis");
    }

    // Sempre mostra última página
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }, [data.totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= data.totalPages) {
      setCurrentPage(page);
    }
  };

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < data.totalPages;

  return (
    <Dialog
      open={trigger.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Reset estados ao fechar
          setSearch("");
          setCurrentPage(1);
        }
        trigger.onClose();
      }}
    >
      <DialogContent className="w-full md:max-w-5xl" showCloseButton={false}>
        <InputGroup className="w-full min-w-full">
          <InputGroupInput
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar leads..."
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex items-center justify-between">
          <span>Leads encontrados</span>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {data.total} {data.total === 1 ? "resultado" : "resultados"}
            </span>
          )}
        </div>

        <div className="min-h-[400px] space-y-1">
          {isLoading ? (
            Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))
          ) : data.leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">
                {debouncedSearch
                  ? "Nenhum lead encontrado com esse termo"
                  : "Nenhum lead cadastrado"}
              </p>
            </div>
          ) : (
            data.leads.map((lead) => (
              <div
                key={lead.id}
                className="px-3 py-3 hover:bg-accent rounded-md transition cursor-pointer"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{lead.name}</span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {lead.email && <span>{lead.email}</span>}
                    {lead.phone && <span>{lead.phone}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!isLoading && data.totalPages > 1 && (
          <DialogFooter>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={
                      !canGoPrevious
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {pageNumbers.map((pageNum, index) =>
                  pageNum === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNum)}
                        isActive={pageNum === currentPage}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={
                      !canGoNext
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
