import { Separator } from "@/components/ui/separator";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Action } from "../../types";
import { ActionPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ViewActionModal } from "../view-action-modal";

interface Props {
  action: Action;
}

const priorityColors = {
  [ActionPriority.NONE]: "",
  [ActionPriority.URGENT]: "bg-red-500/10",
  [ActionPriority.HIGH]: "bg-red-500/10",
  [ActionPriority.MEDIUM]: "bg-yellow-500/10",
  [ActionPriority.LOW]: "bg-green-500/10",
} as const;

export function KanbanCard({ action }: Props) {
  const [open, setOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: action.id,
    data: {
      type: "Action",
      action,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setOpen(true)}
        className={cn(
          "bg-muted rounded-md p-2.5 mb-1.5 space-y-3 cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary transition-all",
          isDragging ? "opacity-30" : "cursor-pointer",
        )}
      >
        <div>
          <span
            className={cn(
              "rounded-sm px-1 py-0.5 truncate text-xs font-semibold",
              priorityColors[action.priority],
            )}
          >
            {action.priority}
          </span>
        </div>
        <div className="flex flex-col gap-y-1">
          <p className="text-sm font-medium line-clamp-1">{action.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {action.description}
          </p>
        </div>

        <Separator className="bg-border/40" />

        <div className="flex items-center justify-between gap-x-1.5">
          <div className="">
            <span className="text-xs text-muted-foreground">
              {action.dueDate?.toLocaleDateString()}
            </span>
          </div>
          {/* Participants */}
          <div className="flex -space-x-2">
            {action.participants.slice(0, 6).map((participant) => (
              <Avatar className="size-6 border-2" key={participant.user.id}>
                <AvatarImage
                  src={participant?.user?.image || ""}
                  alt={participant.user.name}
                />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {participant.user.name[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {action.participants.length > 6 && (
              <Avatar className="size-6 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-bold">
                  +{action.participants.length - 6}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>

      <ViewActionModal
        actionId={action.id}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
