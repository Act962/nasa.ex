"use client";

import { useState } from "react";
import {
  MoreHorizontalIcon,
  MoveRightIcon,
  CopyIcon,
  Share2Icon,
  StarIcon,
  ArchiveIcon,
  Building2Icon,
  Trash2Icon,
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
} from "@/features/workspace/hooks/use-workspace";
import { useDeleteAction } from "../hooks/use-tasks";
import { ShareActionDialog } from "./share-action-dialog";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface Props {
  actionId: string;
  actionTitle?: string;
  workspaceId: string;
  isFavorited?: boolean;
  isArchived?: boolean;
  createdBy?: string;
  onClose?: () => void;
  className?: string;
}

export function CardActionsMenu({
  actionId,
  actionTitle = "Card",
  workspaceId,
  isFavorited = false,
  isArchived = false,
  createdBy,
  onClose,
  className,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const copyAction = useCopyAction();
  const moveAction = useMoveAction();
  const updateFields = useUpdateActionFields();
  const deleteAction = useDeleteAction();
  const { columns } = useColumnsByWorkspace(workspaceId);
  const session = authClient.useSession();

  const canDelete =
    isArchived && !!createdBy && createdBy === session.data?.user?.id;

  const handleCopy = () => copyAction.mutate({ actionId });

  const handleMoveTo = (columnId: string) => {
    moveAction.mutate({ actionId, columnId, workspaceId });
  };

  const handleToggleFavorite = () => {
    updateFields.mutate({ actionId, isFavorited: !isFavorited });
    toast.success(
      isFavorited ? "Removido dos favoritos" : "Adicionado aos favoritos",
    );
  };

  const handleToggleArchive = () => {
    updateFields.mutate({ actionId, isArchived: !isArchived });
    toast.success(isArchived ? "Ação restaurada" : "Ação arquivada");
    if (!isArchived) onClose?.();
  };

  const handleDelete = () => {
    deleteAction.mutate(
      { actionId },
      {
        onSuccess: () => {
          toast.success("Ação excluída permanentemente");
          onClose?.();
        },
        onError: () => toast.error("Erro ao excluir ação"),
      },
    );
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/actions/${actionId}`,
    );
    toast.success("Link copiado!");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 text-muted-foreground hover:text-foreground",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-52"
          onClick={(e) => e.stopPropagation()}
        >
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
                    onClick={() => handleMoveTo(col.id)}
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

          {/* Share with another company */}
          <DropdownMenuItem
            onClick={() => setShareOpen(true)}
            className="gap-2 text-violet-600 focus:text-violet-700 focus:bg-violet-50 dark:focus:bg-violet-950/30"
          >
            <Building2Icon className="size-3.5" />
            Compartilhar com empresa
          </DropdownMenuItem>

          {/* Favorite */}
          <DropdownMenuItem
            onClick={handleToggleFavorite}
            disabled={updateFields.isPending}
            className="gap-2"
          >
            <StarIcon
              className={cn(
                "size-3.5",
                isFavorited && "fill-yellow-400 text-yellow-400",
              )}
            />
            {isFavorited ? "Remover favorito" : "Favoritar"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Archive */}
          <DropdownMenuItem
            onClick={handleToggleArchive}
            disabled={updateFields.isPending}
            className={cn(
              "gap-2",
              !isArchived && "text-destructive focus:text-destructive",
            )}
          >
            <ArchiveIcon
              className={cn("size-3.5", !isArchived && "text-destructive")}
            />
            {isArchived ? "Restaurar" : "Arquivar"}
          </DropdownMenuItem>

          {/* Permanent delete — only for archived actions created by current user */}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={deleteAction.isPending}
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2Icon className="size-3.5 text-destructive" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareActionDialog
        actionId={actionId}
        actionTitle={actionTitle}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
