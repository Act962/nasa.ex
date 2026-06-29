"use client";

import { useState } from "react";
import {
  StarIcon,
  PinIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useFavoritedActions } from "@/features/actions/hooks/use-tasks";
import { ViewActionModal } from "@/features/actions/components/view-action-modal";
import { CardActionsMenu } from "@/features/actions/components/card-actions-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ActionPriority } from "@/generated/prisma/enums";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, ListTodoIcon } from "lucide-react";

interface Props {
  workspaceId: string;
}

const PRIORITY_COLOR: Record<ActionPriority, string> = {
  [ActionPriority.NONE]: "#6B7280",
  [ActionPriority.LOW]: "#22c55e",
  [ActionPriority.MEDIUM]: "#eab308",
  [ActionPriority.HIGH]: "#f97316",
  [ActionPriority.URGENT]: "#ef4444",
};

const PRIORITY_LABEL: Record<ActionPriority, string | null> = {
  [ActionPriority.NONE]: null,
  [ActionPriority.LOW]: "Baixa",
  [ActionPriority.MEDIUM]: "Média",
  [ActionPriority.HIGH]: "Alta",
  [ActionPriority.URGENT]: "Urgente",
};

function formatDueDate(date: Date) {
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const label = today
    ? "Hoje"
    : tomorrow
      ? "Amanhã"
      : format(date, "dd MMM", { locale: ptBR });
  return { label, overdue, today };
}

export function FavoritesSection({ workspaceId }: Props) {
  const { actions, isLoading } = useFavoritedActions(workspaceId);
  const [collapsed, setCollapsed] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  if (!isLoading && actions.length === 0) return null;

  return (
    <>
      <div className="shrink-0 px-4 pt-3 pb-0">
        {/* Header */}
        <button
          className="flex items-center gap-1.5 mb-2 group"
          onClick={() => setCollapsed((isCollapsed) => !isCollapsed)}
        >
          <span className="text-xs font-semibold text-foreground/80">
            Meus Favoritos
          </span>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              ({actions.length})
            </span>
          )}
          {collapsed ? (
            <ChevronRightIcon className="size-3.5 text-muted-foreground ml-0.5" />
          ) : (
            <ChevronDownIcon className="size-3.5 text-muted-foreground ml-0.5" />
          )}
        </button>

        {!collapsed && (
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="shrink-0 w-56 h-28 rounded-xl" />
                ))
              : actions.map((action: any) => {
                  const priorityLabel =
                    PRIORITY_LABEL[action.priority as ActionPriority];
                  const priorityColor =
                    PRIORITY_COLOR[action.priority as ActionPriority];
                  const doneSubActions = (action.subActions ?? []).filter(
                    (s: any) => s.isDone,
                  ).length;
                  const totalSubActions = (action.subActions ?? []).length;
                  const dueDateInfo = action.dueDate
                    ? formatDueDate(new Date(action.dueDate))
                    : null;
                  const tags = action.tags ?? [];

                  return (
                    <div
                      key={action.id}
                      className={cn(
                        "shrink-0 w-56 rounded-xl border border-border/50 shadow-sm",
                        "bg-card hover:shadow-md transition-all duration-200 cursor-pointer",
                        "group/fav relative overflow-hidden",
                        action.isDone && "opacity-60",
                      )}
                      onClick={() => setOpenActionId(action.id)}
                    >
                      {/* Favorite kind badge */}
                      <div
                        className="absolute top-2 left-2 z-10 flex items-center gap-1"
                        title={
                          action.favoriteKind === "global"
                            ? "Fixado para o workspace"
                            : "Seu favorito"
                        }
                      >
                        {action.favoriteKind === "global" ? (
                          <PinIcon className="size-3.5 fill-violet-500 text-violet-500 drop-shadow" />
                        ) : (
                          <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400 drop-shadow" />
                        )}
                      </div>

                      {/* 3-dot menu */}
                      <div
                        className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover/fav:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CardActionsMenu
                          actionId={action.id}
                          workspaceId={action.workspaceId}
                          isFavorited={action.isFavorited}
                          isFavoritedByMe={action.isFavoritedByMe}
                          isArchived={action.isArchived}
                          createdBy={action.createdBy}
                          className="size-6"
                        />
                      </div>

                      <div className="px-3 pt-7 pb-3 space-y-1.5">
                        {/* Priority + tags */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {priorityLabel && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                backgroundColor: priorityColor + "22",
                                color: priorityColor,
                              }}
                            >
                              <span
                                className="size-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: priorityColor }}
                              />
                              {priorityLabel}
                            </span>
                          )}
                          {tags.slice(0, 1).map(({ tag }: any) => (
                            <span
                              key={tag.id}
                              className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[70px]"
                              style={{
                                backgroundColor: tag.color + "22",
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>

                        {/* Title */}
                        <p
                          className={cn(
                            "text-xs font-semibold leading-snug line-clamp-2",
                            action.isDone &&
                              "line-through text-muted-foreground",
                          )}
                        >
                          {action.title}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {totalSubActions > 0 && (
                              <span
                                className={cn(
                                  "flex items-center gap-0.5 text-[10px]",
                                  doneSubActions === totalSubActions &&
                                    "text-emerald-500",
                                )}
                              >
                                <ListTodoIcon className="size-3 shrink-0" />
                                {doneSubActions}/{totalSubActions}
                              </span>
                            )}
                            {dueDateInfo && (
                              <span
                                className={cn(
                                  "flex items-center gap-0.5 text-[10px]",
                                  dueDateInfo.overdue &&
                                    "text-red-500 font-medium",
                                  dueDateInfo.today &&
                                    "text-orange-500 font-medium",
                                )}
                              >
                                <CalendarIcon className="size-3 shrink-0" />
                                <span className="capitalize">
                                  {dueDateInfo.label}
                                </span>
                              </span>
                            )}
                          </div>

                          {(action.participants ?? []).length > 0 && (
                            <div className="flex -space-x-1 shrink-0">
                              {(action.participants ?? [])
                                .slice(0, 2)
                                .map((p: any) => (
                                  <Avatar
                                    className="size-4 ring-1 ring-background"
                                    key={p.user.id}
                                  >
                                    <AvatarImage
                                      src={p.user.image || ""}
                                      alt={p.user.name}
                                    />
                                    <AvatarFallback className="text-[7px] font-bold">
                                      {p.user.name[0].toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        )}

        {/* Separator line */}
        {!collapsed && actions.length > 0 && (
          <div className="border-b border-border/40 -mx-4" />
        )}
      </div>

      {openActionId && (
        <ViewActionModal
          actionId={openActionId}
          open={!!openActionId}
          onOpenChange={(open) => !open && setOpenActionId(null)}
        />
      )}
    </>
  );
}
