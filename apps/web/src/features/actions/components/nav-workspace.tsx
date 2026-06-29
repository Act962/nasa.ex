"use client";

import {
  ArchiveIcon,
  CircleCheckIcon,
  CircleIcon,
  RedoDotIcon,
  Trash2Icon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActionStore } from "../context/use-action";
import { useParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useState } from "react";
import {
  useArchiveActions,
  useColumnsByWorkspace,
  useDeleteActions,
  useMoveActions,
  useSuspenseWokspaces,
} from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { useActionFilters } from "../hooks/use-action-filters";
import { DeleteActionsDialog } from "./delete-actions-dialog";

export function NavWorkspace() {
  const params = useParams<{ workspaceId: string }>();
  // params can be null depending on where we are, but in a workspace it should be there.
  const workspaceId = params?.workspaceId || "";

  const { data: workspacesData } = useSuspenseWokspaces();
  const workspaces = workspacesData?.workspaces || [];

  const { selectedIds, clearSelection } = useActionStore();
  const { filters } = useActionFilters();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Sync selectedWorkspaceId with current workspace when component mounts
  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
    }
  }, [workspaceId]);

  const { columns, isLoading: isLoadingColumns } =
    useColumnsByWorkspace(selectedWorkspaceId);
  const mutationMove = useMoveActions();
  const mutationArchive = useArchiveActions();
  const mutationDelete = useDeleteActions();
  const canDelete = filters.showArchived;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearSelection]);

  if (selectedIds.length === 0) return null;

  const handleMoveToColumn = (columnId: string) => {
    mutationMove.mutate({
      actionIds: selectedIds,
      workspaceId: selectedWorkspaceId,
      columnId,
    });
  };

  return (
    <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-full max-w-2xl bg-background border rounded-lg px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={clearSelection}
          className="rounded-full h-8 w-8"
        >
          <X className="size-4" />
        </Button>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {selectedIds.length} selecionados
        </Badge>
      </div>

      <div className="flex items-center gap-x-2">
        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            className="rounded-md gap-2"
            disabled={mutationDelete.isPending}
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2Icon className="size-4" />
            {mutationDelete.isPending ? "Deletando..." : "Deletar"}
          </Button>
        )}
        {!canDelete && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-md gap-2"
            disabled={mutationArchive.isPending}
            onClick={() => mutationArchive.mutate({ actionIds: selectedIds })}
          >
            <ArchiveIcon className="size-4" />
            {mutationArchive.isPending ? "Arquivando..." : "Arquivar"}
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="rounded-md gap-2"
              disabled={mutationMove.isPending}
            >
              <RedoDotIcon className="size-4" />
              {mutationMove.isPending ? "Movendo..." : "Mover para"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-64 p-2">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 tracking-wider">
                Workspaces
              </h3>
              <Separator />
              <div className="h-full overflow-y-auto">
                <ScrollArea className="max-h-30">
                  <div className="p-1">
                    {workspaces.map((w) => (
                      <div
                        className={cn(
                          "flex items-center gap-x-2 cursor-pointer hover:bg-accent rounded-md px-3 py-2 text-sm transition-colors",
                          w.id === selectedWorkspaceId && "bg-accent",
                        )}
                        key={w.id}
                        onClick={() => setSelectedWorkspaceId(w.id)}
                      >
                        {w.id === selectedWorkspaceId ? (
                          <CircleCheckIcon className="size-4 text-primary" />
                        ) : (
                          <CircleIcon className="size-4 text-muted-foreground/30" />
                        )}
                        <span className="font-medium">{w.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <h3 className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 tracking-wider mt-2">
                Colunas de Destino
              </h3>
              <Separator />
              <div className=" max-h-40 overflow-y-auto">
                <ScrollArea className="h-full">
                  <div className=" p-1">
                    {isLoadingColumns && (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        Carregando colunas...
                      </div>
                    )}
                    {!isLoadingColumns && columns.length === 0 && (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        Nenhuma coluna encontrada
                      </div>
                    )}
                    {columns?.map((col: any) => (
                      <div
                        className="flex items-center gap-x-2 cursor-pointer hover:bg-accent rounded-md px-3 py-2 text-sm transition-colors"
                        key={col.id}
                        onClick={() => handleMoveToColumn(col.id)}
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color || "#888" }}
                        />
                        <span className="font-medium">{col.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Dialog de confirmação para deletar ações */}
      <DeleteActionsDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() =>
          mutationDelete.mutate(
            { actionIds: selectedIds },
            { onSuccess: () => setIsDeleteDialogOpen(false) },
          )
        }
        count={selectedIds.length}
        isLoading={mutationDelete.isPending}
      />
    </nav>
  );
}
