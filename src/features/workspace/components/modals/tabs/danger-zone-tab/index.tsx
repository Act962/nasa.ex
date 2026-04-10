"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeleteWorkspace } from "@/features/workspace/hooks/use-workspace";
import { DeleteWorkspaceConfirmDialog } from "./confirm-dialog";
import { useRouter } from "next/navigation";

interface Props {
  workspace: any;
  onDeleted: () => void;
}

export function DangerZoneTab({ workspace, onDeleted }: Props) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const deleteWorkspace = useDeleteWorkspace();

  const handleDelete = () => {
    deleteWorkspace.mutate(
      { workspaceId: workspace.id },
      {
        onSuccess: () => {
          onDeleted();
          setIsConfirmOpen(false);
          router.replace("/workspaces");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
        <div>
          <h3 className="text-lg font-medium text-destructive">
            Deletar Workspace
          </h3>
          <p className="text-sm text-muted-foreground">
            Uma vez deletado, todos os dados relacionados ao workspace serão
            perdidos. Você não poderá deletar se houver ações vinculadas.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setIsConfirmOpen(true)}
          className="w-full sm:w-auto"
        >
          Deletar Workspace
        </Button>
      </div>

      <DeleteWorkspaceConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        workspaceName={workspace.name}
        isLoading={deleteWorkspace.isPending}
      />
    </div>
  );
}
