"use client";

import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PlusIcon,
  MoreHorizontalIcon,
  ArrowUpRightIcon,
  XIcon,
  UserPlusIcon,
  CheckIcon,
  GripVerticalIcon,
} from "lucide-react";
import { Action } from "../../types";
import { DatePicker } from "../data-picker";

interface SubActionItemProps {
  sub: NonNullable<Action["subActions"]>[number];
  members: any[];
  fromDate?: Date;
  toDate?: Date;
  isExpanded: boolean;
  isEditingTitle: boolean;
  onToggleExpand: () => void;
  onEditTitleStart: () => void;
  onEditTitleEnd: () => void;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      finishDate?: Date | null;
    },
  ) => void;
  onAddResponsible: (subActionId: string, userId: string) => void;
  onRemoveResponsible: (subActionId: string, userId: string) => void;
  onPromote: (id: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function SubActionItem({
  sub,
  members,
  fromDate,
  toDate,
  isExpanded,
  isEditingTitle,
  onToggleExpand,
  onEditTitleStart,
  onEditTitleEnd,
  onToggle,
  onDelete,
  onUpdate,
  onAddResponsible,
  onRemoveResponsible,
  onPromote,
  isUpdating,
  isDeleting,
}: SubActionItemProps) {
  const finishDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinishDateChange = useCallback(
    (date: Date) => {
      if (finishDateTimerRef.current) clearTimeout(finishDateTimerRef.current);
      finishDateTimerRef.current = setTimeout(() => {
        onUpdate(sub.id, { finishDate: date });
      }, 700);
    },
    [onUpdate, sub.id],
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id, data: { type: "subaction" } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-transparent hover:border-border hover:bg-muted/40 transition-colors",
        isExpanded && "border-border bg-muted/60",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5 px-2 py-1.5 group">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="size-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          aria-label="Arrastar"
        >
          <GripVerticalIcon className="size-3.5" />
        </button>

        <Checkbox
          checked={sub.isDone}
          onCheckedChange={() => onToggle(sub.id, sub.isDone)}
          className="shrink-0 mt-1"
        />

        {isEditingTitle ? (
          <Input
            autoFocus
            defaultValue={sub.title}
            className="h-7 text-sm flex-1 min-w-0"
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== sub.title) {
                onUpdate(sub.id, { title: val });
              }
              onEditTitleEnd();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = e.currentTarget.value.trim();
                if (val && val !== sub.title) {
                  onUpdate(sub.id, { title: val });
                }
                onEditTitleEnd();
              }
              if (e.key === "Escape") onEditTitleEnd();
            }}
          />
        ) : (
          <button
            className={cn(
              "flex-1 min-w-0 text-sm text-left py-0.5 break-words whitespace-normal leading-snug",
              sub.isDone && "line-through text-muted-foreground",
            )}
            onClick={onToggleExpand}
            onDoubleClick={onEditTitleStart}
          >
            {sub.title}
          </button>
        )}

        {sub.responsibles.length > 0 && (
          <div className="flex -space-x-1 shrink-0 mt-0.5">
            {sub.responsibles.slice(0, 3).map((r) => (
              <Avatar key={r.user.id} className="size-5 ring-1 ring-background">
                <AvatarImage src={r.user.image ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {r.user.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {sub.responsibles.length > 3 && (
              <span className="text-[10px] text-muted-foreground ml-1.5 self-center">
                +{sub.responsibles.length - 3}
              </span>
            )}
          </div>
        )}

        {sub.finishDate && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-1">
            {new Date(sub.finishDate).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEditTitleStart} className="gap-2">
              <PlusIcon className="size-3.5 rotate-45" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onPromote(sub.id)}
              disabled={isUpdating}
              className="gap-2"
            >
              <ArrowUpRightIcon className="size-3.5" />
              Transformar em ação
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(sub.id)}
              disabled={isDeleting}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <XIcon className="size-3.5" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 mt-0.5 pt-2.5">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Título
            </p>
            <Input
              placeholder="Título da sub-ação..."
              defaultValue={sub.title}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val && val !== sub.title) {
                  onUpdate(sub.id, { title: val });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.currentTarget.value.trim();
                  if (val && val !== sub.title) {
                    onUpdate(sub.id, { title: val });
                  }
                  e.currentTarget.blur();
                }
              }}
              className="h-8 text-xs font-medium"
            />
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Descrição
            </p>
            <Textarea
              placeholder="Adicione uma descrição..."
              defaultValue={sub.description ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim() || null;
                if (val !== (sub.description ?? null)) {
                  onUpdate(sub.id, { description: val });
                }
              }}
              className="text-xs min-h-[60px] resize-none break-words"
            />
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Prazo
            </p>
            <DatePicker
              value={sub.finishDate ? new Date(sub.finishDate) : undefined}
              onChange={handleFinishDateChange}
              placeholder="Sem data"
              className="h-8 text-xs bg-background"
              fromDate={fromDate}
              toDate={toDate}
            />
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Responsáveis
            </p>
            <div className="space-y-1 mb-2">
              {sub.responsibles.map((r) => (
                <div
                  key={r.user.id}
                  className="flex items-center gap-2 group/resp"
                >
                  <Avatar className="size-5 shrink-0">
                    <AvatarImage src={r.user.image ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {r.user.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs flex-1 truncate">{r.user.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 opacity-0 group-hover/resp:opacity-100 transition-opacity shrink-0"
                    onClick={() => onRemoveResponsible(sub.id, r.user.id)}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>

            {members.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-full text-xs gap-1 bg-background"
                  >
                    <UserPlusIcon className="size-3" />
                    Atribuir responsável
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="start">
                  <p className="text-[10px] font-medium text-muted-foreground mb-2 px-1 uppercase tracking-wide">
                    Membros
                  </p>
                  <div className="space-y-0.5">
                    {members.map((m: any) => {
                      const isAssigned = sub.responsibles.some(
                        (r) => r.user.id === m.user.id,
                      );
                      return (
                        <button
                          key={m.user.id}
                          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-left"
                          onClick={() =>
                            isAssigned
                              ? onRemoveResponsible(sub.id, m.user.id)
                              : onAddResponsible(sub.id, m.user.id)
                          }
                        >
                          <Avatar className="size-5 shrink-0">
                            <AvatarImage src={m.user.image ?? undefined} />
                            <AvatarFallback className="text-[9px]">
                              {m.user.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs flex-1 truncate">
                            {m.user.name}
                          </span>
                          {isAssigned && (
                            <CheckIcon className="size-3 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
