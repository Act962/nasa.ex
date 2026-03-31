"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Action } from "../../types";
import { ActionPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ViewActionModal } from "../view-action-modal";
import { CardActionsMenu } from "../card-actions-menu";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlignLeftIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ListTodoIcon,
  PaperclipIcon,
  StarIcon,
} from "lucide-react";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface Props {
  action: Action;
}

const PRIORITY_COLOR: Record<ActionPriority, string> = {
  [ActionPriority.NONE]:   "#6B7280",
  [ActionPriority.LOW]:    "#22c55e",
  [ActionPriority.MEDIUM]: "#eab308",
  [ActionPriority.HIGH]:   "#f97316",
  [ActionPriority.URGENT]: "#ef4444",
};

const PRIORITY_LABEL: Record<ActionPriority, string | null> = {
  [ActionPriority.NONE]:   null,
  [ActionPriority.LOW]:    "Baixa",
  [ActionPriority.MEDIUM]: "Média",
  [ActionPriority.HIGH]:   "Alta",
  [ActionPriority.URGENT]: "Urgente",
};

function formatDueDate(date: Date) {
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const label = today ? "Hoje" : tomorrow ? "Amanhã" : format(date, "dd MMM", { locale: ptBR });
  return { label, overdue, today };
}

// Placeholder cover shown when card has no image
const PLACEHOLDER_BG = "bg-gradient-to-br from-muted to-muted/40";

export function KanbanCard({ action }: Props) {
  const [open, setOpen] = useState(false);
  const coverUrl = useConstructUrl((action as any).coverImage || "");

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: action.id,
    data: { type: "Action", action },
  });

  const style = { transition, transform: CSS.Translate.toString(transform) };

  const hasCover = !!(action as any).coverImage && coverUrl;
  const priorityLabel = PRIORITY_LABEL[action.priority];
  const priorityColor = PRIORITY_COLOR[action.priority];
  const doneSubActions = action.subActions.filter((s) => s.isDone).length;
  const totalSubActions = action.subActions.length;
  const tags = (action as any).tags as { tag: { id: string; name: string; color: string } }[] | undefined;
  const attachments = ((action as any).attachments ?? []) as any[];
  const hasDescription = !!action.description;
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
          "rounded-xl mb-2.5 cursor-grab active:cursor-grabbing overflow-hidden",
          "border border-border/50 shadow-sm hover:shadow-md transition-shadow",
          "bg-card group/card",
          action.isDone && "opacity-60",
        )}
      >
        {/* ── COVER IMAGE ─────────────────────────────────── */}
        <div className={cn("relative w-full h-36 overflow-hidden", !hasCover && PLACEHOLDER_BG)}>
          {hasCover ? (
            <img
              src={coverUrl}
              alt="Capa"
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            /* Subtle gradient placeholder */
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <AlignLeftIcon className="size-8 text-foreground" />
            </div>
          )}

          {/* 3-dot menu – top right */}
          <div
            className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <CardActionsMenu
              actionId={action.id}
              workspaceId={action.workspaceId}
              isFavorited={(action as any).isFavorited}
              isArchived={(action as any).isArchived}
              className="size-7 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm"
            />
          </div>

          {/* Favorite star */}
          {(action as any).isFavorited && (
            <div className="absolute top-2 left-2">
              <StarIcon className="size-4 fill-yellow-400 text-yellow-400 drop-shadow" />
            </div>
          )}
        </div>

        {/* ── CONTENT AREA ────────────────────────────────── */}
        <div className="px-3 pt-2.5 pb-3 space-y-2">

          {/* Status row: priority pill + done badge */}
          <div className="flex items-center gap-2">
            {priorityLabel && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: priorityColor + "22", color: priorityColor }}
              >
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityColor }} />
                {priorityLabel}
              </span>
            )}
            {action.isDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="size-3" />
                Concluído
              </span>
            )}
            {/* Tags */}
            {tags && tags.slice(0, 2).map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[80px]"
                style={{ backgroundColor: tag.color + "22", color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>

          {/* Title */}
          <p className={cn(
            "text-sm font-semibold leading-snug line-clamp-2",
            action.isDone && "line-through text-muted-foreground",
          )}>
            {action.title}
          </p>

          {/* Footer row: metadata + avatars */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Left: icons */}
            <div className="flex items-center gap-2.5 text-muted-foreground">
              {hasDescription && (
                <AlignLeftIcon className="size-3.5 shrink-0" />
              )}

              {attachments.length > 0 && (
                <span className="flex items-center gap-0.5 text-[11px]">
                  <PaperclipIcon className="size-3.5 shrink-0" />
                  {attachments.length}
                </span>
              )}

              {totalSubActions > 0 && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  doneSubActions === totalSubActions && "text-emerald-500",
                )}>
                  <ListTodoIcon className="size-3.5 shrink-0" />
                  {doneSubActions}/{totalSubActions}
                </span>
              )}

              {dueDateInfo && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  dueDateInfo.overdue && "text-red-500 font-medium",
                  dueDateInfo.today && "text-orange-500 font-medium",
                )}>
                  <CalendarIcon className="size-3.5 shrink-0" />
                  <span className="capitalize">{dueDateInfo.label}</span>
                </span>
              )}
            </div>

            {/* Right: participant avatars */}
            {action.participants.length > 0 && (
              <div className="flex -space-x-1.5 shrink-0">
                {action.participants.slice(0, 3).map((p) => (
                  <Avatar className="size-5 ring-1 ring-background" key={p.user.id}>
                    <AvatarImage src={p.user.image || ""} alt={p.user.name} />
                    <AvatarFallback className="text-[8px] font-bold">
                      {p.user.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {action.participants.length > 3 && (
                  <Avatar className="size-5 ring-1 ring-background">
                    <AvatarFallback className="text-[8px] font-bold">
                      +{action.participants.length - 3}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ViewActionModal actionId={action.id} open={open} onOpenChange={setOpen} />
    </>
  );
}
