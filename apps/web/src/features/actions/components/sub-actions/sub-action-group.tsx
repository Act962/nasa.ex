"use client";

import { useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  group: {
    id: string;
    name: string;
    isOpen: boolean;
  };
  count: number;
  doneCount: number;
  onUpdate?: (data: { name?: string; isOpen?: boolean }) => void;
  onDelete?: (deleteSubActions: boolean) => void;
  children: ReactNode;
}

export function SubActionGroup({
  group,
  count,
  doneCount,
  onUpdate,
  onDelete,
  children,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: group.id,
    data: { type: "group-droppable" },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
    data: { type: "group" },
  });

  const setNodeRef = (node: HTMLDivElement | null) => {
    setDroppableRef(node);
    setSortableRef(node);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const open = group.isOpen;

  const toggleOpen = () => onUpdate?.({ isOpen: !open });

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== group.name) {
      onUpdate?.({ name: trimmed });
    } else {
      setName(group.name);
    }
    setEditing(false);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "rounded-md border border-border/40 bg-muted/20 transition-colors",
          isOver && "border-primary/40 bg-primary/5",
          isDragging && "opacity-40",
        )}
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5 group/folder">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="size-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover/folder:opacity-100 transition-opacity shrink-0"
            aria-label="Arrastar pasta"
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
          <button
            onClick={toggleOpen}
            className="size-5 inline-flex items-center justify-center rounded hover:bg-muted shrink-0"
          >
            {open ? (
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-3.5 text-muted-foreground" />
            )}
          </button>
          {open ? (
            <FolderOpenIcon className="size-3.5 text-amber-500 shrink-0" />
          ) : (
            <FolderIcon className="size-3.5 text-amber-500 shrink-0" />
          )}

          {editing ? (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setName(group.name);
                  setEditing(false);
                }
              }}
              className="h-6 text-sm flex-1 min-w-0"
            />
          ) : (
            <button
              onClick={toggleOpen}
              onDoubleClick={() => setEditing(true)}
              className="flex-1 min-w-0 text-left text-sm font-medium truncate"
            >
              {group.name}
            </button>
          )}

          {count > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {doneCount}/{count}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 group-hover/folder:opacity-100 transition-opacity shrink-0"
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => setEditing(true)}
                className="gap-2"
              >
                <PencilIcon className="size-3.5" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmOpen(true)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <TrashIcon className="size-3.5" />
                Excluir pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {open && <div className="px-2 pb-2">{children}</div>}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta &quot;{group.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {count > 0
                ? "As sub-ações desta pasta serão movidas para fora dela. Você pode optar por excluí-las junto."
                : "A pasta está vazia e será removida."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {count > 0 && (
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete?.(true);
                  setConfirmOpen(false);
                }}
              >
                Excluir tudo
              </Button>
            )}
            <AlertDialogAction
              onClick={() => {
                onDelete?.(false);
                setConfirmOpen(false);
              }}
            >
              Apenas a pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
