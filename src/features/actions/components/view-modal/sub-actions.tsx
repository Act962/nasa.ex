import { useRef, useState, type KeyboardEvent } from "react";
import {
  CheckIcon,
  PlusIcon,
  MoreHorizontalIcon,
  UserPlusIcon,
  XIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Action } from "../../types";
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

interface SubActionsProps {
  subActions?: Action["subActions"];
  members?: any[];
  action?: Pick<Action, "startDate" | "dueDate">;
  onCreate: (title: string) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: { description?: string | null; finishDate?: Date | null },
  ) => void;
  onAddResponsible: (subActionId: string, userId: string) => void;
  onRemoveResponsible: (subActionId: string, userId: string) => void;
  onPromote: (id: string) => void;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating?: boolean;
}

export function ActionSubActions({
  subActions = [],
  members = [],
  action,
  onCreate,
  onToggle,
  onDelete,
  onUpdate,
  onAddResponsible,
  onRemoveResponsible,
  onPromote,
  isCreating,
  isDeleting,
  isUpdating,
}: SubActionsProps) {
  const [newSubActionTitle, setNewSubActionTitle] = useState("");
  const [addingSubAction, setAddingSubAction] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const subActionInputRef = useRef<HTMLInputElement>(null);

  const totalSubActions = subActions.length;
  const doneSubActions = subActions.filter((s) => s.isDone).length;

  const handleAddSubAction = () => {
    const title = newSubActionTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewSubActionTitle("");
    setAddingSubAction(false);
  };

  const handleSubActionKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddSubAction();
    if (e.key === "Escape") {
      setAddingSubAction(false);
      setNewSubActionTitle("");
    }
  };

  const minDate = action?.startDate
    ? new Date(action.startDate).toISOString().split("T")[0]
    : undefined;
  const maxDate = action?.dueDate
    ? new Date(action.dueDate).toISOString().split("T")[0]
    : undefined;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sub-ações
          </p>
          {totalSubActions > 0 && (
            <span className="text-xs text-muted-foreground">
              {doneSubActions}/{totalSubActions}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => {
            setAddingSubAction(true);
            setTimeout(() => subActionInputRef.current?.focus(), 0);
          }}
        >
          <PlusIcon className="size-3.5" />
          Adicionar
        </Button>
      </div>

      {/* Progress bar */}
      {totalSubActions > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5 mb-2">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all"
            style={{
              width: `${(doneSubActions / totalSubActions) * 100}%`,
            }}
          />
        </div>
      )}

      {/* List */}
      <div className="space-y-1">
        {subActions.map((sub) => {
          const isExpanded = expandedId === sub.id;
          const finishDateValue = sub.finishDate
            ? new Date(sub.finishDate).toISOString().split("T")[0]
            : "";

          return (
            <div
              key={sub.id}
              className="rounded-md border border-transparent hover:border-border hover:bg-muted/40 transition-colors"
            >
              {/* Main row */}
              <div className="flex items-center gap-2 px-2 py-1.5 group">
                <Checkbox
                  checked={sub.isDone}
                  onCheckedChange={() => onToggle(sub.id, sub.isDone)}
                  className="shrink-0"
                />

                <button
                  className={cn(
                    "flex-1 text-sm text-left",
                    sub.isDone && "line-through text-muted-foreground",
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                >
                  {sub.title}
                </button>

                {/* Responsible avatars */}
                {sub.responsibles.length > 0 && (
                  <div className="flex -space-x-1 shrink-0">
                    {sub.responsibles.slice(0, 3).map((r) => (
                      <Avatar
                        key={r.user.id}
                        className="size-5 ring-1 ring-background"
                      >
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

                {/* finishDate badge */}
                {sub.finishDate && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {new Date(sub.finishDate).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                )}

                {/* Options menu */}
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

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/50 mt-0.5 pt-2.5">
                  {/* Description */}
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
                      className="text-xs min-h-[60px] resize-none"
                    />
                  </div>

                  {/* Prazo */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Prazo
                    </p>
                    <Input
                      type="date"
                      className="h-7 text-xs"
                      defaultValue={finishDateValue}
                      min={minDate}
                      max={maxDate}
                      onChange={(e) => {
                        const val = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        onUpdate(sub.id, { finishDate: val });
                      }}
                    />
                  </div>

                  {/* Responsáveis */}
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
                          <span className="text-xs flex-1 truncate">
                            {r.user.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 opacity-0 group-hover/resp:opacity-100 transition-opacity shrink-0"
                            onClick={() =>
                              onRemoveResponsible(sub.id, r.user.id)
                            }
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
                                    <AvatarImage
                                      src={m.user.image ?? undefined}
                                    />
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
        })}

        {/* Add new sub-action inline */}
        {addingSubAction && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="size-4 shrink-0" />
            <Input
              ref={subActionInputRef}
              placeholder="Título da sub-ação..."
              value={newSubActionTitle}
              onChange={(e) => setNewSubActionTitle(e.target.value)}
              onKeyDown={handleSubActionKeyDown}
              onBlur={() => {
                if (!newSubActionTitle.trim()) {
                  setAddingSubAction(false);
                }
              }}
              className="h-7 text-sm"
              disabled={isCreating}
            />
            <Button
              size="sm"
              className="h-7 px-2"
              onClick={handleAddSubAction}
              disabled={!newSubActionTitle.trim() || isCreating}
            >
              <CheckIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
