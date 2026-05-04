"use client";

import { useState } from "react";
import {
  MoreHorizontalIcon,
  MoveRightIcon,
  CopyIcon,
  Share2Icon,
  StarIcon,
  PinIcon,
  PinOffIcon,
  ArchiveIcon,
  Building2Icon,
  Trash2Icon,
  FolderKanbanIcon,
  CalendarPlusIcon,
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
import { useToggleFavoritePersonal } from "../hooks/use-toggle-favorite-personal";
import { useToggleFavoriteGlobal } from "../hooks/use-toggle-favorite-global";
import { ShareActionDialog } from "./share-action-dialog";
import { MoveActionWorkspaceDialog } from "./move-action-workspace";
import { ActionToPlannerDialog } from "@/features/workspace/components/action-to-planner-button";
import { authClient } from "@/lib/auth-client";
import { useOrgRole } from "@/hooks/use-org-role";
import { cn } from "@/lib/utils";

interface Props {
  actionId: string;
  actionTitle?: string;
  workspaceId: string;
  isFavorited?: boolean;
  isFavoritedByMe?: boolean;
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
  isFavoritedByMe = false,
  isArchived = false,
  createdBy,
  onClose,
  className,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [moveWorkspaceOpen, setMoveWorkspaceOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  // const [historicOpen, setHistoricOpen] = useState(false);
  // const [isModalOpen, setIsModalOpen] = useState(false);
  const copyAction = useCopyAction();
  const moveAction = useMoveAction();
  const updateFields = useUpdateActionFields();
  const togglePersonal = useToggleFavoritePersonal(workspaceId);
  const toggleGlobal = useToggleFavoriteGlobal(workspaceId);
  const deleteAction = useDeleteAction();
  const { columns } = useColumnsByWorkspace(workspaceId);
  const session = authClient.useSession();
  const { isMaster, isAdmin, isModerador } = useOrgRole();
  const canManageGlobal = isMaster || isAdmin || isModerador;

  const canDelete =
    isArchived && !!createdBy && createdBy === session.data?.user?.id;

  const handleCopy = () => copyAction.mutate({ actionId });

  const handleMoveTo = (columnId: string) => {
    moveAction.mutate({ actionId, columnId, workspaceId });
  };

  const handleTogglePersonal = () => togglePersonal.mutate({ actionId });
  const handleToggleGlobal = () => toggleGlobal.mutate({ actionId });

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
      `${window.location.origin}/workspaces/${workspaceId}?actionId=${actionId}`,
    );
    toast.success("Link copiado!");
  };

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/actions/${actionId}`,
    );
    toast.success("Link público copiado!");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 text-muted-foreground hover:text-foreground cursor-pointer",
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
              <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                <MoveRightIcon className="size-3.5" />
                Mover para
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {columns.map((col: any) => (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => handleMoveTo(col.id)}
                    className="gap-2 cursor-pointer"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: col.color || "#888" }}
                    />
                    {col.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setMoveWorkspaceOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <FolderKanbanIcon className="size-3.5" />
                  Mover de workspace
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Copy */}
          <DropdownMenuItem
            onClick={handleCopy}
            disabled={copyAction.isPending}
            className="gap-2 cursor-pointer"
          >
            <CopyIcon className="size-3.5" />
            Duplicar ação
          </DropdownMenuItem>

          {/* Add to Planner */}
          <DropdownMenuItem
            onClick={() => setPlannerOpen(true)}
            className="gap-2 cursor-pointer text-violet-600 focus:text-violet-700 focus:bg-violet-50 dark:focus:bg-violet-950/30"
          >
            <CalendarPlusIcon className="size-3.5" />
            Adicionar ao Planner
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Share link */}
          {/* <DropdownMenuItem onClick={handleShareLink} className="gap-2">
            <Share2Icon className="size-3.5" />
            Copiar link
          </DropdownMenuItem> */}

          {/* Public SEO link */}
          <DropdownMenuItem onClick={handleCopyPublicLink} className="gap-2 cursor-pointer">
            <Share2Icon className="size-3.5" />
            Copiar link
          </DropdownMenuItem>

          {/* Share with another company */}
          <DropdownMenuItem
            onClick={() => setShareOpen(true)}
            className="gap-2 text-violet-600 focus:text-violet-700 focus:bg-violet-50 dark:focus:bg-violet-950/30 cursor-pointer"
          >
            <Building2Icon className="size-3.5" />
            Compartilhar com empresa
          </DropdownMenuItem>

          {/* Personal favorite */}
          <DropdownMenuItem
            onClick={handleTogglePersonal}
            disabled={togglePersonal.isPending}
            className="gap-2 cursor-pointer"
          >
            <StarIcon
              className={cn(
                "size-3.5 transition-transform",
                isFavoritedByMe && "fill-yellow-400 text-yellow-400 scale-110",
              )}
            />
            {isFavoritedByMe
              ? "Remover dos meus favoritos"
              : "Favoritar pra mim"}
          </DropdownMenuItem>

          {/* Global favorite (admin/owner/moderador only) */}
          {canManageGlobal && (
            <DropdownMenuItem
              onClick={handleToggleGlobal}
              disabled={toggleGlobal.isPending}
              className="gap-2 cursor-pointer"
            >
              {isFavorited ? (
                <PinOffIcon className="size-3.5" />
              ) : (
                <PinIcon className="size-3.5 text-violet-600" />
              )}
              {isFavorited ? "Desfixar de todos" : "Fixar para todos"}
            </DropdownMenuItem>
          )}

          {/* History */}
          {/* <DropdownMenuItem
            onClick={() => setHistoricOpen(true)}
            className="gap-2 md:hidden"
          >
            <HistoryIcon className="size-3.5" />
            Histórico
          </DropdownMenuItem> */}

          <DropdownMenuSeparator />

          {/* Archive */}
          <DropdownMenuItem
            onClick={handleToggleArchive}
            disabled={updateFields.isPending}
            className={cn(
              "gap-2 cursor-pointer",
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
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
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
      <MoveActionWorkspaceDialog
        actionId={actionId}
        actionTitle={actionTitle}
        currentWorkspaceId={workspaceId}
        open={moveWorkspaceOpen}
        onOpenChange={setMoveWorkspaceOpen}
      />
      <ActionToPlannerDialog
        actionId={actionId}
        actionTitle={actionTitle}
        open={plannerOpen}
        onOpenChange={setPlannerOpen}
      />
      {/* <HistoricSheet
        actionId={actionId}
        workspaceId={workspaceId}
        open={historicOpen}
        onOpenChange={setHistoricOpen}
      /> */}
    </>
  );
}
