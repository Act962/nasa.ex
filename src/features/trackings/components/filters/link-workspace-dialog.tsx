"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUpdateWorkspace,
  useWorkspaces,
} from "@/features/workspace/hooks/use-workspace";
import { Spinner } from "@/components/ui/spinner";

interface LinkWorkspaceDialogProps {
  trackingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkWorkspaceDialog({
  trackingId,
  open,
  onOpenChange,
}: LinkWorkspaceDialogProps) {
  const { data, isPending } = useWorkspaces();
  const updateWorkspace = useUpdateWorkspace();

  // Já conectados a este tracking não aparecem — não há o que vincular.
  const available = (data?.workspaces ?? []).filter(
    (workspace) => workspace.trackingId !== trackingId,
  );

  const onLink = (workspaceId: string) => {
    updateWorkspace.mutate(
      { workspaceId, trackingId },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Vincular workspace</DialogTitle>
          <DialogDescription>
            Workspaces dos quais você é membro. Vincular move as ações do
            workspace para este tracking.
          </DialogDescription>
        </DialogHeader>

        {isPending && (
          <div className="flex justify-center py-6">
            <Spinner className="size-5" />
          </div>
        )}

        {!isPending && available.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todos os seus workspaces já estão conectados a este tracking.
          </p>
        )}

        <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {available.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => onLink(workspace.id)}
              disabled={updateWorkspace.isPending}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-hidden hover:bg-accent focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="truncate">
                {workspace.icon ? `${workspace.icon} ` : ""}
                {workspace.name}
              </span>
              {workspace.tracking && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  vinculado a {workspace.tracking.name}
                </span>
              )}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={updateWorkspace.isPending}
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
