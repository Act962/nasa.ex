"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { FilterIcon, Search, UserSearch, X, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced";
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
import {
  useQueryTrackings,
  useQueryStatus,
} from "@/features/trackings/hooks/use-trackings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SearchConversations } from "@/features/tracking-chat/components/search-conversaitons";

const ITEMS_PER_PAGE = 6;

interface SearchLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchLeadModal({ open, onOpenChange }: SearchLeadModalProps) {
  const router = useRouter();
  const params = useParams<{ trackingId: string }>();
  const { trackings } = useQueryTrackings();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(
    params.trackingId || null,
  );
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);

  const { status: statuses } = useQueryStatus({
    trackingId: selectedTrackingId ?? "",
  });

  const debouncedSearch = useDebouncedValue(search, 200);

  const handleTrackingSelect = (id: string | null) => {
    setSelectedTrackingId((prev) => {
      const next = prev === id ? null : id;
      if (next !== prev) setSelectedStatusId(null);
      return next;
    });
    setCurrentPage(1);
  };

  const handleStatusSelect = (id: string | null) => {
    setSelectedStatusId((prev) => (prev === id ? null : id));
    setCurrentPage(1);
  };

  const handleOnLead = ({ id }: { id: string }) => {
    router.push(`/contatos/${id}`);
    onOpenChange(false);
  };

  // Reset para página 1 quando a busca mudar
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const { data, isLoading } = useQuery(
    orpc.leads.search.queryOptions({
      input: {
        search: debouncedSearch,
        trackingId: selectedTrackingId || undefined,
        statusId: selectedStatusId || undefined,
        limit: ITEMS_PER_PAGE,
        page: currentPage,
      },
      enabled: open,
    }),
  );

  // Gera números de página visíveis de forma inteligente e responsiva
  const pageNumbers = useMemo(() => {
    if (!data) return;
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
  }, [data?.totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    if (data && page >= 1 && page <= data.totalPages) {
      setCurrentPage(page);
    }
  };

  const canGoPrevious = currentPage > 1;
  const canGoNext = data && currentPage < data.totalPages;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setSearch("");
          setCurrentPage(1);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="w-full md:max-w-5xl" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar Lead</DialogTitle>
        </DialogHeader>

        <SearchConversations
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusSelect}
          onTrackingChange={handleTrackingSelect}
          search={search}
          statusId={selectedStatusId}
          trackingId={selectedTrackingId}
          align="end"
        />

        <div className="flex items-center justify-between">
          <span className="text-sm md:text-base">Leads encontrados</span>
          {!isLoading && data && (
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
          ) : data?.leads.length === 0 ? (
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
            data?.leads.map((lead) => (
              <div
                key={lead.id}
                className="px-3 py-3 hover:bg-accent rounded-md transition cursor-pointer"
                onClick={() => handleOnLead({ id: lead.id })}
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

        {!isLoading && data && data.totalPages > 1 && (
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
                {pageNumbers?.map((pageNum, index) =>
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
                  ),
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
