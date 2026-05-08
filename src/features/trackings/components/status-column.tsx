import { Button } from "@/components/ui/button";
import { memo, useEffect, useMemo, useRef } from "react";
import { useInfiniteLeadsByStatus } from "../hooks/use-trackings";
import { LeadItem } from "./lead-item";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { CSS } from "@dnd-kit/utilities";
import { StatusHeader } from "./status-header";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { EMPTY_LEADS, useKanbanStore } from "../lib/kanban-store";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StatusColumnProps {
  status: {
    id: string;
    name: string;
    color: string | null;
    leads: number;
  };
  index: number;
  trackingId: string;
  isOverlay?: boolean;
}

function StatusColumnImpl({
  status,
  index,
  trackingId,
  isOverlay,
}: StatusColumnProps) {
  const registerColumn = useKanbanStore((s) => s.registerColumn);
  const isMobile = useIsMobile();

  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [participantFilter] = useQueryState("participant");
  const [tagsFilter] = useQueryState("tags");
  const [temperatureFilter] = useQueryState("temperature");
  const [actionFilter] = useQueryState("filter");
  const [statusFlowFilter] = useQueryState("status_flow");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: status.id,
    data: {
      type: "Column",
      column: status,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>(null);

  const queryInput = useMemo(
    () => ({
      dateInit: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
      dateEnd: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
      participantFilter: participantFilter || undefined,
      tagsFilter: tagsFilter ? tagsFilter.split(",") : undefined,
      temperatureFilter: temperatureFilter
        ? temperatureFilter.split(",")
        : undefined,
      actionFilter: actionFilter || "ACTIVE",
      statusFlowFilter: statusFlowFilter
        ? statusFlowFilter.split(",")
        : undefined,
    }),
    [
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
      statusFlowFilter,
    ],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteLeadsByStatus({
      statusId: status.id,
      trackingId,
      enabled: !isOverlay,
      ...queryInput,
    });

  // Observer só ativo no desktop e quando não for overlay
  useEffect(() => {
    if (isMobile || isOverlay) {
      observerRef.current?.disconnect();
      return;
    }

    const sentinel = sentinelRef.current;
    const scrollContainer = sentinel?.closest(
      "[data-kanban-scroll-viewport]",
    ) as HTMLElement | null;

    if (!sentinel || !scrollContainer) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: scrollContainer,
        threshold: 0.1,
        rootMargin: "0px 0px 50px 0px",
      },
    );

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [isMobile, isOverlay, hasNextPage, fetchNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (isOverlay) return;
    registerColumn(status.id, data);
  }, [data, registerColumn, status.id, isOverlay]);

  const headerData = useMemo(
    () => ({ ...status, trackingId }),
    [status, trackingId],
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-column-id={status.id}
      className={cn(
        "shrink-0 w-68 h-full flex flex-col select-none",
        isDragging && "z-50",
        index === 0 && "ml-4",
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/60 shadow-md">
        <StatusHeader
          data={headerData}
          attributes={attributes}
          listeners={listeners}
        />

        {/* Caso der bug novamente
        <div
          data-kanban-scroll-viewport
          className="flex-1 min-h-0 overflow-y-auto scrollbar-thin"
        >*/}

        <ScrollArea
          data-kanban-scroll-viewport
          className="flex-1 min-h-0 scrollbar-thin"
        >
          <ol className="mx-1 px-1 py-2 flex flex-col gap-y-2">
            <LeadsList columnId={status.id} isLoading={isLoading} />

            {hasNextPage && (
              <li className="list-none">
                {isMobile ? (
                  // Mobile: botão explícito abaixo do último card
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                  >
                    {isFetchingNextPage ? (
                      <Spinner className="size-4" />
                    ) : (
                      "Buscar mais"
                    )}
                  </Button>
                ) : (
                  // Desktop: sentinel invisível para o IntersectionObserver
                  <div
                    ref={sentinelRef}
                    className="h-10 flex items-center justify-center"
                  >
                    {isFetchingNextPage && <Spinner className="size-4" />}
                  </div>
                )}
              </li>
            )}
          </ol>
        </ScrollArea>
      </div>
    </li>
  );
}

// Subscriber isolado: lê leads do store + renderiza a lista. Quando o user
// faz drag (moveLeadInColumn/ToColumn muda `state.columns[id].leads`),
// SÓ este componente re-renderiza, NÃO o StatusColumn pai. Isso evita o
// re-render dos botões Radix em StatusHeader, que tinham ref churn em
// loop ("Maximum update depth").
function LeadsList({
  columnId,
  isLoading,
}: {
  columnId: string;
  isLoading: boolean;
}) {
  const leads = useKanbanStore(
    (state) => state.columns[columnId]?.leads ?? EMPTY_LEADS,
  );
  const leadIds = useMemo(() => leads.map((l) => l.id), [leads]);

  return (
    <SortableContext items={leadIds}>
      {isLoading && (
        <div className="flex flex-col gap-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-md shadow-sm" />
          ))}
        </div>
      )}
      {!isLoading &&
        leads.map((lead) => <LeadItem key={lead.id} data={lead} />)}
    </SortableContext>
  );
}

// memo + custom equality: ignora `leads` count (que muda a cada drag).
// O contador é exibido por <StatusLeadsCount> dentro de StatusHeader, que
// se subscreve sozinho via TanStack Query e re-renderiza em isolamento.
// Isso evita que mudanças no count cascateem em re-renders dos botões
// Radix (Slot/useComposedRefs) — origem do "Maximum update depth".
export const StatusColumn = memo(StatusColumnImpl, (prev, next) => {
  if (prev.index !== next.index) return false;
  if (prev.trackingId !== next.trackingId) return false;
  if (prev.isOverlay !== next.isOverlay) return false;
  if (prev.status === next.status) return true;
  return (
    prev.status.id === next.status.id &&
    prev.status.name === next.status.name &&
    prev.status.color === next.status.color
  );
});
StatusColumn.displayName = "StatusColumn";

export const StatusItemSkeleton = () => {
  return (
    <li className="shrink-0 w-72 h-full flex flex-col select-none">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl bg-muted/40 border border-border/50 shadow-sm pb-2 overflow-hidden">
        <div className="p-3">
          <Skeleton className="h-7 w-3/4 rounded-md" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <ol className="mx-2 px-1 py-3 flex flex-col gap-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </ol>
        </div>
        <div className="px-2 pt-1 border-t border-border/10">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </li>
  );
};
