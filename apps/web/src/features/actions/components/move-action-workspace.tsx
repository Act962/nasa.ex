"use client";

import { useState } from "react";
import { FolderKanbanIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useSuspenseWokspaces,
  useColumnsByWorkspace,
  useMoveAction,
} from "@/features/workspace/hooks/use-workspace";
import { toast } from "sonner";

interface Props {
  actionId: string;
  actionTitle: string;
  currentWorkspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveActionWorkspaceDialog({
  actionId,
  actionTitle,
  currentWorkspaceId,
  open,
  onOpenChange,
}: Props) {
  const { data: workspacesData } = useSuspenseWokspaces();
  const workspaces = workspacesData?.workspaces || [];

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");

  const { columns, isLoading: isLoadingColumns } =
    useColumnsByWorkspace(selectedWorkspaceId);
  const moveAction = useMoveAction();

  const handleMove = () => {
    if (!selectedWorkspaceId || !selectedColumnId) return;

    moveAction.mutate(
      {
        actionId,
        workspaceId: selectedWorkspaceId,
        columnId: selectedColumnId,
      },
      {
        onSuccess: () => {
          toast.success("Card movido com sucesso!");
          onOpenChange(false);
        },
      },
    );
  };

  // Filter out the current workspace
  const availableWorkspaces = workspaces.filter(
    (w) => w.id !== currentWorkspaceId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanbanIcon className="size-5 text-violet-500" />
            Mover para outro Workspace
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione o workspace e o status (coluna) para onde deseja mover o
            card{" "}
            <span className="font-medium text-foreground">{actionTitle}</span>.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Workspace Destino</Label>
            <Select
              value={selectedWorkspaceId}
              onValueChange={(val) => {
                setSelectedWorkspaceId(val);
                setSelectedColumnId(""); // Reset column when workspace changes
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um workspace" />
              </SelectTrigger>
              <SelectContent>
                {availableWorkspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
                {availableWorkspaces.length === 0 && (
                  <div className="p-2 inset-0 text-sm text-muted-foreground text-center">
                    Nenhum outro workspace encontrado.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedWorkspaceId && (
            <div className="space-y-2">
              <Label>Status (Coluna) Destino</Label>
              <Select
                value={selectedColumnId}
                onValueChange={setSelectedColumnId}
                disabled={isLoadingColumns || columns.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingColumns
                        ? "Carregando..."
                        : columns.length === 0
                          ? "Nenhuma coluna encontrada"
                          : "Selecione uma coluna"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col: any) => (
                    <SelectItem key={col.id} value={col.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color || "#888" }}
                        />
                        {col.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMove}
            disabled={
              !selectedWorkspaceId || !selectedColumnId || moveAction.isPending
            }
          >
            {moveAction.isPending ? "Movendo..." : "Mover Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
