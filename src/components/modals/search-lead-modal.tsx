"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useSearchLead } from "@/hooks/use-search-lead";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Search, UserSearch, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

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

  // Gera números de página visíveis de forma inteligente e responsiva
  const pageNumbers = useMemo(() => {
    const { totalPages } = data;
    const pages: (number | "ellipsis")[] = [];

    // Em mobile, mostra menos páginas
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const maxVisiblePages = isMobile ? 3 : 7;
    const delta = isMobile ? 0 : 2;

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Para mobile: mostra apenas [1] ... [current] ... [last]
    if (isMobile) {
      if (currentPage === 1) {
        return [1, "ellipsis", totalPages];
      } else if (currentPage === totalPages) {
        return [1, "ellipsis", totalPages];
      } else {
        return [1, "ellipsis", currentPage, "ellipsis", totalPages];
      }
    }

    // Desktop: lógica original
    pages.push(1);

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    if (rangeStart > 2) {
      pages.push("ellipsis");
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (rangeEnd < totalPages - 1) {
      pages.push("ellipsis");
    }

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
          {search && (
            <InputGroupAddon
              align={"inline-end"}
              onClick={() => setSearch("")}
              className="cursor-pointer"
            >
              <X className="size-4" />
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex items-center justify-between">
          <span className="text-sm md:text-base">Leads encontrados</span>
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
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant={"icon"}>
                  <UserSearch />
                </EmptyMedia>
                <EmptyTitle>Não encontrado</EmptyTitle>
                <EmptyDescription>
                  {debouncedSearch
                    ? "Nenhum lead encontrado com esse termo"
                    : "Nenhum lead cadastrado"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
            {/* Paginação Mobile */}
            <div className="flex md:hidden items-center justify-between w-full gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!canGoPrevious}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm text-muted-foreground">
                {currentPage} / {data.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!canGoNext}
                className="gap-1"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Paginação Desktop */}
            <Pagination className="hidden md:flex justify-end">
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
                        onClick={() => handlePageChange(pageNum as number)}
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
                    size={"sm"}
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
