"use client";
import { useListRecentActions } from "@/features/actions/hooks/use-tasks";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { ViewActionModal } from "@/features/actions/components/view-action-modal";

export function RecentTasks() {
  const { data, isLoading } = useListRecentActions(7);
  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const actions = data?.actions ?? [];

  if (actions.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground italic">
        Nenhuma ação recente nos últimos 7 dias.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col pt-2">
        {actions.map((action: any) => (
          <Item
            key={action.id}
            onClick={() => {
              setActionId(action.id);
              setOpen(true);
            }}
            className="cursor-pointer hover:bg-muted/50 transition-colors duration-100"
          >
            <ItemMedia>
              {action.isDone ? (
                <CheckCircle2 className="size-5 text-emerald-500" />
              ) : (
                <Clock className="size-5 text-amber-500" />
              )}
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="flex items-center gap-2">
                {action.title}
                {action.isDone && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    Concluída
                  </Badge>
                )}
              </ItemTitle>
              <ItemDescription>Em {action.workspace.name}</ItemDescription>
            </ItemContent>
            <ItemContent className="items-end">
              <span className="text-xs text-muted-foreground">
                Criada por {action.user.name}
              </span>
            </ItemContent>
          </Item>
        ))}
      </div>

      {actionId && (
        <ViewActionModal
          actionId={actionId}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
