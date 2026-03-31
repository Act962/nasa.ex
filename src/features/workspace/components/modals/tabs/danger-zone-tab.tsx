"use client";

import { Button } from "@/components/ui/button";
import { useDeleteWorkspace } from "@/features/workspace/hooks/use-workspace";

interface Props {
  workspace: any;
  onDeleted: () => void;
}

export function DangerZoneTab({ workspace, onDeleted }: Props) {
  const deleteWorkspace = useDeleteWorkspace();

  const handleDelete = () => {
    if (confirm("Tem certeza que deseja deletar este workspace? Esta ação é irreversível.")) {
      deleteWorkspace.mutate({ workspaceId: workspace.id }, { onSuccess: onDeleted });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
        <div>
          <h3 className="text-lg font-medium text-destructive">Deletar Workspace</h3>
          <p className="text-sm text-muted-foreground">
            Uma vez deletado, todos os dados relacionados ao workspace serão perdidos. Você não poderá deletar se houver ações vinculadas.
          </p>
        </div>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteWorkspace.isPending}>
          {deleteWorkspace.isPending ? "Deletando..." : "Deletar Workspace Permanentemente"}
        </Button>
      </div>
    </div>
  );
}
