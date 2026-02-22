import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useRef } from "react";
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

interface StatusColumnProps {
  status: {
    id: string;
    name: string;
    color: string | null;
  };
  index: number;
  trackingId: string;
  isOverlay?: boolean;
}

export function StatusColumn({
  status,
  index,
  trackingId,
  isOverlay,
}: StatusColumnProps) {
  const { registerColumn } = useKanbanStore();
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [participantFilter] = useQueryState("participant");
  const [tagsFilter] = useQueryState("tags");
  const [temperatureFilter] = useQueryState("temperature");
  const [actionFilter] = useQueryState("filter");
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

  const scrollRef = useRef<HTMLDivElement>(null);

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
    }),
    [
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
    ],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteLeadsByStatus({
      statusId: status.id,
      trackingId,
      enabled: !isOverlay,
      ...queryInput,
    });

  useEffect(() => {
    if (!scrollRef.current || isOverlay) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(scrollRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage, isOverlay]);

  useEffect(() => {
    if (isOverlay) return;
    registerColumn(status.id, data);
  }, [data, registerColumn, status.id, isOverlay]);

  const leads = useKanbanStore(
    (state) => state.columns[status.id]?.leads ?? EMPTY_LEADS,
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
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/60  shadow-md ">
        <StatusHeader
          data={{ ...status, trackingId }}
          attributes={attributes}
          listeners={listeners}
        />

        <ScrollArea className="flex-1 min-h-0">
          <ol className="mx-1 px-1 py-2 flex flex-col gap-y-2">
            <SortableContext items={leads.map((l) => l.id)}>
              {leads.map((lead) => (
                <LeadItem key={lead.id} data={lead} />
              ))}
            </SortableContext>

            {/* ✅ Elemento sentinela no final da lista */}
            {hasNextPage && (
              <div
                ref={scrollRef}
                className="h-10 flex items-center justify-center"
              >
                {isFetchingNextPage && <Spinner className="size-4" />}
              </div>
            )}

            {/* {leads.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-10 opacity-20 select-none grayscale">
                <div className="p-3 rounded-full bg-muted mb-2">
                  <User className="size-8" />
                </div>
                <p className="text-xs font-medium">Nenhum lead</p>
              </div>
            )} */}
          </ol>
        </ScrollArea>

        {/* <LeadForm statusId={status.id} /> */}
      </div>
    </li>
  );
}

export const StatusItemSkeleton = () => {
  return (
    <li className="shrink-0 w-72 h-full flex flex-col select-none">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl bg-muted/40 border border-border/50 shadow-sm pb-2 overflow-hidden">
        <div className="p-3">
          <Skeleton className="h-7 w-3/4 rounded-md" />
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <ol className="mx-2 px-1 py-3 flex flex-col gap-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </ol>
        </ScrollArea>
        <div className="px-2 pt-1 border-t border-border/10">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </li>
  );
};
