import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Action } from "../../types";
import { ActionPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ViewActionModal } from "../view-action-modal";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, CheckCircle2Icon, ListTodoIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Props {
  action: Action;
}

const PRIORITY_CONFIG = {
  [ActionPriority.NONE]: null,
  [ActionPriority.LOW]: {
    label: "Baixa",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  [ActionPriority.MEDIUM]: {
    label: "Média",
    dot: "bg-yellow-500",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  [ActionPriority.HIGH]: {
    label: "Alta",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
  },
  [ActionPriority.URGENT]: {
    label: "Urgente",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
} as const;

function formatDueDate(date: Date): {
  label: string;
  overdue: boolean;
  today: boolean;
  tomorrow: boolean;
} {
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);

  let label: string;
  if (today) label = "Hoje";
  else if (tomorrow) label = "Amanhã";
  else label = format(date, "dd MMM", { locale: ptBR });

  return { label, overdue, today, tomorrow };
}

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
    data: { type: "Action", action },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const priorityConfig = PRIORITY_CONFIG[action.priority];

  const doneSubActions = action.subActions.filter((s) => s.isDone).length;
  const totalSubActions = action.subActions.length;
  const allSubDone = totalSubActions > 0 && doneSubActions === totalSubActions;

  const dueDateInfo = action.dueDate ? formatDueDate(action.dueDate) : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setOpen(true)}
        className={cn(
          "bg-muted border border-border/60 rounded-md mb-2 cursor-grab active:cursor-grabbing transition-all",
          // isDragging && "opacity-30 shadow-lg",
          action.isDone && "opacity-70",
        )}
      >
        <div className="px-3 py-2">
          {/* Top row: priority + done badge */}
          <div className="flex items-center justify-between mb-2.5">
            {priorityConfig ? (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    priorityConfig.dot,
                  )}
                />
                <span
                  className={cn("text-[11px] font-medium", priorityConfig.text)}
                >
                  {priorityConfig.label}
                </span>
              </div>
            ) : (
              <span />
            )}

            {action.isDone && (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="size-3.5" />
                <span className="text-[11px] font-medium">Feito</span>
              </div>
            )}
          </div>

          {/* Title */}
          <p
            className={cn(
              "text-sm font-medium leading-snug line-clamp-2 mb-3",
              action.isDone && "line-through text-muted-foreground",
            )}
          >
            {action.title}
          </p>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {/* Left: date + sub-actions */}
          <div className="flex items-center gap-2 min-w-0">
            {dueDateInfo ? (
              <div
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  dueDateInfo.overdue
                    ? "text-red-500 dark:text-red-400 font-medium"
                    : dueDateInfo.today
                      ? "text-orange-500 dark:text-orange-400 font-medium"
                      : "text-muted-foreground",
                )}
              >
                <CalendarIcon className="size-3 shrink-0" />
                <span>{dueDateInfo.label}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full">
                <CalendarIcon className="size-3 shrink-0" />
                <span>{formatDueDate(action.createdAt).label}</span>
              </div>
            )}

            {totalSubActions > 0 && (
              <div
                className={cn(
                  "flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full",
                  allSubDone
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <ListTodoIcon className="size-3 shrink-0" />
                <span className="font-medium tabular-nums">
                  {doneSubActions}/{totalSubActions}
                </span>
              </div>
            )}
          </div>

          {/* Right: participants */}
          {action.participants.length > 0 && (
            <div className="flex -space-x-1.5 shrink-0">
              {action.participants.slice(0, 4).map((participant) => (
                <Avatar
                  className="size-5 border border-background ring-0"
                  key={participant.user.id}
                >
                  <AvatarImage
                    src={participant.user.image || ""}
                    alt={participant.user.name}
                  />
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                    {participant.user.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {action.participants.length > 4 && (
                <Avatar className="size-5 border border-background">
                  <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-bold">
                    +{action.participants.length - 4}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          )}
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
