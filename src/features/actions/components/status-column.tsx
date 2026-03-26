import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  id: string;
  name: string;
  workspaceId: string;
  color: string | null;
  actionsCount: number;
}

export function WorkspaceColumn({
  id,
  color,
  workspaceId,
  name,
  actionsCount,
}: Props) {
  return (
    <li className={cn("shrink-0 w-68 h-full flex flex-col select-none")}>
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/60  shadow-md ">
        <KanbanColumnHeader name={name} actionsCount={actionsCount} />
        {/* <ScrollArea className="flex-1 min-h-0">
          <ol className=" mx-1 px-1 py-2 flex flex-col gap-y-2">
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
            </SortableContext> */}
        {/* ✅ Elemento sentinela no final da lista */}
        {/* {hasNextPage && (
              <div
                ref={scrollRef}
                className="h-10 flex items-center justify-center"
              >
                {isFetchingNextPage && <Spinner className="size-4" />}
              </div>
            )}
          </ol>
        </ScrollArea> */}
      </div>
    </li>
  );
}

export const KanbanColumnHeader = ({
  name,
  actionsCount,
}: Pick<Props, "name" | "actionsCount">) => {
  return (
    <div className="pt-2 px-2 text-sm font-medium flex  items-start gap-x-2">
      <span className="truncate">{name}</span>
      <span className="bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full text-xs font-medium">
        {actionsCount || 0}
      </span>
    </div>
  );
};

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
