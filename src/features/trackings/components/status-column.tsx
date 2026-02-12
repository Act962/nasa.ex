import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";
import { useInfiniteLeadsByStatus } from "../hooks/use-trackings";
import { LeadItem } from "./lead-item";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { LeadForm } from "./lead-form";
import { Skeleton } from "@/components/ui/skeleton";
import { CSS } from "@dnd-kit/utilities";
import { StatusHeader } from "./status-header";
import { SortableContext, useSortable } from "@dnd-kit/sortable";

interface StatusColumnProps {
  status: {
    id: string;
    name: string;
    color: string | null;
  };
  index: number;
  trackingId: string;
}

export function StatusColumn({ status, index, trackingId }: StatusColumnProps) {
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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteLeadsByStatus({
      statusId: status.id,
      trackingId,
    });

  useEffect(() => {
    if (!scrollRef.current) return;

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
  }, [hasNextPage, fetchNextPage]);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "shrink-0 w-68 h-full flex flex-col select-none",
        isDragging && "z-50",
        index === 0 && "ml-4",
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/60  shadow-md pb-2">
        <StatusHeader
          data={{ ...status, trackingId }}
          attributes={attributes}
          listeners={listeners}
        />

        <ScrollArea className="flex-1 min-h-0">
          <ol className="mx-1 px-1 py-2 flex flex-col gap-y-2">
            <SortableContext items={data.map((l) => l.id)}>
              {data.map((lead) => (
                <LeadItem key={lead.id} data={lead} />
              ))}
            </SortableContext>

            {/* ✅ Elemento sentinela no final da lista */}
            {hasNextPage && <div ref={scrollRef} className="h-4" />}

            {/* Indicador de carregamento opcional */}
            {isFetchingNextPage && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Spinner />
              </div>
            )}
          </ol>
        </ScrollArea>
        <LeadForm statusId={status.id} />
      </div>
    </li>
  );
}

export const StatusItemSkeleton = () => {
  return (
    <li className="shrink-0 w-68 h-full flex flex-col select-none">
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/80 shadow-md pb-2 ">
        <Skeleton className="h-10 mx-1 mt-2" />
        <ScrollArea className="flex-1 min-h-0">
          <ol className="mx-1 px-1 py-2 flex flex-col gap-y-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </ol>
        </ScrollArea>
        <Skeleton className="h-10 mx-1 " />
      </div>
    </li>
  );
};
