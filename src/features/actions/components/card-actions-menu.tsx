"use client";

import { useState } from "react";
import {
  MoreHorizontalIcon,
  MoveRightIcon,
  CopyIcon,
  Share2Icon,
  StarIcon,
  ArchiveIcon,
  FolderInputIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useCopyAction,
  useMoveAction,
  useUpdateActionFields,
  useColumnsByWorkspace,
  useSuspenseWokspaces,
} from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";

interface Props {
  actionId: string;
  workspaceId: string;
  isFavorited?: boolean;
  isArchived?: boolean;
  onClose?: () => void;
  className?: string;
}

export function CardActionsMenu({
  actionId,
  workspaceId,
  isFavorited = false,
  isArchived = false,
  onClose,
  className,
}: Props) {
  const copyAction = useCopyAction();
  const moveAction = useMoveAction();
  const updateFields = useUpdateActionFields();
  const { columns } = useColumnsByWorkspace(workspaceId);

  const handleCopy = () => {
    copyAction.mutate({ actionId });
  };

  const handleMoveTo = (columnId: string, targetWorkspaceId: string) => {
    moveAction.mutate({ actionId, columnId, workspaceId: targetWorkspaceId });
  };

  const handleToggleFavorite = () => {
    updateFields.mutate({ actionId, isFavorited: !isFavorited });
    toast.success(isFavorited ? "Removido dos favoritos" : "Adicionado aos favoritos");
  };

  const handleToggleArchive = () => {
    updateFields.mutate({ actionId, isArchived: !isArchived });
    toast.success(isArchived ? "Ação restaurada" : "Ação arquivada");
    if (!isArchived) onClose?.();
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}/actions/${actionId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 text-muted-foreground hover:text-foreground", className)}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {/* Move to column */}
        {columns.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <MoveRightIcon className="size-3.5" />
              Mover para
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {columns.map((col: any) => (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() => handleMoveTo(col.id, workspaceId)}
                  className="gap-2"
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: col.color || "#888" }}
                  />
                  {col.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Copy */}
        <DropdownMenuItem
          onClick={handleCopy}
          disabled={copyAction.isPending}
          className="gap-2"
        >
          <CopyIcon className="size-3.5" />
          Copiar ação
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Share link */}
        <DropdownMenuItem onClick={handleShareLink} className="gap-2">
          <Share2Icon className="size-3.5" />
          Copiar link
        </DropdownMenuItem>

        {/* Favorite */}
        <DropdownMenuItem
          onClick={handleToggleFavorite}
          disabled={updateFields.isPending}
          className="gap-2"
        >
          <StarIcon className={cn("size-3.5", isFavorited && "fill-yellow-400 text-yellow-400")} />
          {isFavorited ? "Remover favorito" : "Favoritar"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Archive */}
        <DropdownMenuItem
          onClick={handleToggleArchive}
          disabled={updateFields.isPending}
          className={cn("gap-2", !isArchived && "text-destructive focus:text-destructive")}
        >
          <ArchiveIcon className="size-3.5" />
          {isArchived ? "Restaurar" : "Arquivar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
