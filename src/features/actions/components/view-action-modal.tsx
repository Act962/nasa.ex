"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  EllipsisIcon,
  PlusIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import {
  useQueryAction,
  useUpdateAction,
  useDeleteAction,
  useCreateSubAction,
  useUpdateSubAction,
  useDeleteSubAction,
  useAddResponsible,
  useRemoveResponsible,
} from "../hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRef, useState, useCallback, type KeyboardEvent } from "react";
import { RichtTextEditor } from "@/components/rich-text-editor/editor";
import {
  useColumnsByWorkspace,
  useWorkspaceMembers,
} from "@/features/workspace/hooks/use-workspace";
import { DatePicker } from "./data-picker";
import { ActionPriority } from "@/generated/prisma/enums";
import { toast } from "sonner";

const PRIORITY_CONFIG: Record<
  ActionPriority,
  { label: string; color: string; dot: string }
> = {
  NONE: {
    label: "Nenhuma",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  LOW: { label: "Baixa", color: "text-emerald-500", dot: "bg-emerald-500" },
  MEDIUM: { label: "Média", color: "text-yellow-500", dot: "bg-yellow-500" },
  HIGH: { label: "Alta", color: "text-orange-500", dot: "bg-orange-500" },
  URGENT: { label: "Urgente", color: "text-red-600", dot: "bg-red-600" },
};

interface Props {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewActionModal({ actionId, open, onOpenChange }: Props) {
  const { action, isLoading } = useQueryAction(actionId);
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();
  const createSubAction = useCreateSubAction(actionId);
  const updateSubAction = useUpdateSubAction(actionId);
  const deleteSubAction = useDeleteSubAction(actionId);
  const addResponsible = useAddResponsible(actionId);
  const removeResponsible = useRemoveResponsible(actionId);

  const { columns } = useColumnsByWorkspace(action?.workspaceId ?? "");
  const { members } = useWorkspaceMembers(action?.workspaceId ?? "");

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sub-action form
  const [newSubActionTitle, setNewSubActionTitle] = useState("");
  const [addingSubAction, setAddingSubAction] = useState(false);
  const subActionInputRef = useRef<HTMLInputElement>(null);

  const descriptionSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleTitleClick = () => {
    setTitleValue(action?.title ?? "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleTitleSave = () => {
    if (!titleValue.trim() || titleValue === action?.title) {
      setEditingTitle(false);
      return;
    }
    updateAction.mutate(
      { actionId, title: titleValue.trim() },
      {
        onSuccess: () => setEditingTitle(false),
        onError: () => {
          toast.error("Erro ao atualizar título");
          setEditingTitle(false);
        },
      },
    );
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") setEditingTitle(false);
  };

  const handleDescriptionChange = useCallback(
    (value: string) => {
      if (descriptionSaveTimerRef.current) {
        clearTimeout(descriptionSaveTimerRef.current);
      }
      descriptionSaveTimerRef.current = setTimeout(() => {
        updateAction.mutate({ actionId, description: value });
      }, 800);
    },
    [actionId, updateAction],
  );

  const handleToggleDone = () => {
    updateAction.mutate(
      { actionId, isDone: !action?.isDone },
      { onError: () => toast.error("Erro ao atualizar status") },
    );
  };

  const handlePriorityChange = (priority: string) => {
    updateAction.mutate(
      { actionId, priority: priority as ActionPriority },
      { onError: () => toast.error("Erro ao atualizar prioridade") },
    );
  };

  const handleColumnChange = (columnId: string) => {
    updateAction.mutate(
      { actionId, columnId },
      { onError: () => toast.error("Erro ao atualizar coluna") },
    );
  };

  const handleDueDateChange = (date: Date) => {
    updateAction.mutate(
      { actionId, dueDate: date },
      { onError: () => toast.error("Erro ao atualizar data de entrega") },
    );
  };

  const handleStartDateChange = (date: Date) => {
    updateAction.mutate(
      { actionId, startDate: date },
      { onError: () => toast.error("Erro ao atualizar data de início") },
    );
  };

  const handleAddSubAction = () => {
    const title = newSubActionTitle.trim();
    if (!title) return;
    createSubAction.mutate(
      { actionId, title },
      {
        onSuccess: () => {
          setNewSubActionTitle("");
          setAddingSubAction(false);
        },
        onError: () => toast.error("Erro ao criar sub-ação"),
      },
    );
  };

  const handleSubActionKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddSubAction();
    if (e.key === "Escape") {
      setAddingSubAction(false);
      setNewSubActionTitle("");
    }
  };

  const handleToggleSubAction = (subActionId: string, isDone: boolean) => {
    updateSubAction.mutate(
      { subActionId, isDone: !isDone },
      { onError: () => toast.error("Erro ao atualizar sub-ação") },
    );
  };

  const handleDeleteSubAction = (subActionId: string) => {
    deleteSubAction.mutate(
      { subActionId },
      { onError: () => toast.error("Erro ao deletar sub-ação") },
    );
  };

  const handleToggleResponsible = (userId: string) => {
    const isResponsible = action?.responsibles.some(
      (r) => r.user.id === userId,
    );
    if (isResponsible) {
      removeResponsible.mutate(
        { actionId, userId },
        { onError: () => toast.error("Erro ao remover responsável") },
      );
    } else {
      addResponsible.mutate(
        { actionId, userId },
        { onError: () => toast.error("Erro ao adicionar responsável") },
      );
    }
  };

  const handleDelete = () => {
    deleteAction.mutate(
      { actionId },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Ação deletada");
        },
        onError: () => toast.error("Erro ao deletar ação"),
      },
    );
  };

  const currentColumn = columns.find((c) => c.id === action?.columnId);
  const priority = action?.priority ?? "NONE";
  const priorityConfig = PRIORITY_CONFIG[priority as ActionPriority];

  const doneSubActions =
    action?.subActions?.filter((s) => s.isDone).length ?? 0;
  const totalSubActions = action?.subActions?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogDescription className="sr-only">
        Visualizar e editar ação
      </DialogDescription>
      <DialogContent
        className="p-0 sm:max-w-[90%] bg-muted overflow-hidden flex flex-col max-h-[90vh] gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <span className="truncate">{action?.workspace?.name}</span>
            <ChevronRightIcon className="size-3.5 shrink-0" />
            <span className="truncate font-medium text-foreground">
              {isLoading ? <Skeleton className="h-4 w-32" /> : action?.title}
            </span>
          </div>
          <div className="flex items-center shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                >
                  <EllipsisIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                  disabled={deleteAction.isPending}
                >
                  <Trash2Icon className="size-4 mr-2" />
                  Deletar ação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
              >
                <XIcon className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {/* Title */}
                <div className="flex items-start gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleToggleDone}
                        className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        disabled={updateAction.isPending}
                      >
                        {action?.isDone ? (
                          <CircleCheckIcon className="size-5 text-emerald-500" />
                        ) : (
                          <CircleDashedIcon className="size-5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {action?.isDone
                        ? "Marcar como pendente"
                        : "Marcar como concluído"}
                    </TooltipContent>
                  </Tooltip>

                  {editingTitle ? (
                    <Input
                      ref={titleInputRef}
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={handleTitleKeyDown}
                      className="text-xl font-semibold h-auto border-none shadow-none p-0 focus-visible:ring-0 bg-transparent"
                    />
                  ) : (
                    <h2
                      className={cn(
                        "text-xl font-semibold cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors leading-tight",
                        action?.isDone && "line-through text-muted-foreground",
                      )}
                      onClick={handleTitleClick}
                    >
                      {action?.title}
                    </h2>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Descrição
                  </p>
                  <RichtTextEditor
                    field={action?.description ?? undefined}
                    onChange={handleDescriptionChange}
                  />
                </div>

                {/* Sub-actions */}
                <div className="space-y-2">
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

                  {totalSubActions > 0 && (
                    <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${totalSubActions > 0 ? (doneSubActions / totalSubActions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    {action?.subActions?.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={sub.isDone}
                          onCheckedChange={() =>
                            handleToggleSubAction(sub.id, sub.isDone)
                          }
                          className="shrink-0"
                        />
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            sub.isDone && "line-through text-muted-foreground",
                          )}
                        >
                          {sub.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleDeleteSubAction(sub.id)}
                          disabled={deleteSubAction.isPending}
                        >
                          <XIcon className="size-3" />
                        </Button>
                      </div>
                    ))}

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
                          disabled={createSubAction.isPending}
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={handleAddSubAction}
                          disabled={
                            !newSubActionTitle.trim() ||
                            createSubAction.isPending
                          }
                        >
                          <CheckIcon className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-64 border-l shrink-0 overflow-y-auto bg-muted/80">
            <div className="p-4 space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Status */}
                  <SidebarField label="Status">
                    <Select
                      value={action?.columnId ?? ""}
                      onValueChange={handleColumnChange}
                      disabled={updateAction.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Sem coluna">
                          {currentColumn && (
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    currentColumn.color ?? "#1447e6",
                                }}
                              />
                              <span>{currentColumn.name}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: col.color ?? "#1447e6",
                                }}
                              />
                              {col.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SidebarField>

                  {/* Priority */}
                  <SidebarField label="Prioridade">
                    <Select
                      value={priority}
                      onValueChange={handlePriorityChange}
                      disabled={updateAction.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                priorityConfig.dot,
                              )}
                            />
                            <span className={priorityConfig.color}>
                              {priorityConfig.label}
                            </span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "size-2 rounded-full shrink-0",
                                  cfg.dot,
                                )}
                              />
                              <span className={cfg.color}>{cfg.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SidebarField>

                  {/* Due date */}
                  <SidebarField label="Data de entrega">
                    <DatePicker
                      value={action?.dueDate ?? undefined}
                      onChange={handleDueDateChange}
                      placeholder="Sem data"
                      className="h-8 text-xs bg-background"
                    />
                  </SidebarField>

                  {/* Start date */}
                  <SidebarField label="Data de início">
                    <DatePicker
                      value={action?.startDate ?? undefined}
                      onChange={handleStartDateChange}
                      placeholder="Sem data"
                      className="h-8 text-xs bg-background"
                    />
                  </SidebarField>

                  <Separator />

                  {/* Responsibles */}
                  <SidebarField label="Responsáveis">
                    <div className="space-y-1.5">
                      {action?.responsibles?.map((r) => (
                        <div
                          key={r.user.id}
                          className="flex items-center gap-2 group"
                        >
                          <Avatar className="size-6 shrink-0">
                            <AvatarImage src={r.user.image ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {r.user.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs flex-1 truncate">
                            {r.user.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => handleToggleResponsible(r.user.id)}
                            disabled={removeResponsible.isPending}
                          >
                            <XIcon className="size-3" />
                          </Button>
                        </div>
                      ))}

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-full text-xs gap-1.5 bg-background"
                          >
                            <UserPlusIcon className="size-3.5" />
                            Atribuir responsável
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                            Membros do workspace
                          </p>
                          <div className="space-y-0.5">
                            {members.map((m) => {
                              const isResponsible = action?.responsibles?.some(
                                (r) => r.user.id === m.user.id,
                              );
                              return (
                                <button
                                  key={m.user.id}
                                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-left"
                                  onClick={() =>
                                    handleToggleResponsible(m.user.id)
                                  }
                                  disabled={
                                    addResponsible.isPending ||
                                    removeResponsible.isPending
                                  }
                                >
                                  <Avatar className="size-6 shrink-0">
                                    <AvatarImage
                                      src={m.user.image ?? undefined}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {m.user.name?.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs flex-1 truncate">
                                    {m.user.name}
                                  </span>
                                  {isResponsible && (
                                    <CheckIcon className="size-3.5 text-primary shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </SidebarField>

                  <Separator />

                  {/* Creator */}
                  <SidebarField label="Criado por">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6 shrink-0">
                        <AvatarImage src={action?.user?.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {action?.user?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">
                        {action?.user?.name}
                      </span>
                    </div>
                  </SidebarField>

                  {action?.createdAt && (
                    <SidebarField label="Criado em">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(action.createdAt), "dd MMM yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </SidebarField>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SidebarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
