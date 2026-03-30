import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useColumnsByWorkspace,
  useWorkspaceMembers,
} from "@/features/workspace/hooks/use-workspace";
import { toast } from "sonner";
import { Action } from "../types";
import { ActionHeader } from "./view-modal/header";
import { ActionTitle } from "./view-modal/title";
import { ActionDescription } from "./view-modal/description";
import { ActionSubActions } from "./view-modal/sub-actions";
import { ActionSidebar } from "./view-modal/sidebar";

interface Props {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewActionModal({ actionId, open, onOpenChange }: Props) {
  const { action: rawAction, isLoading } = useQueryAction(actionId);
  const action = (rawAction ?? undefined) as Action | undefined;
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();
  const createSubAction = useCreateSubAction(actionId);
  const updateSubAction = useUpdateSubAction(actionId);
  const deleteSubAction = useDeleteSubAction(actionId);
  const addResponsible = useAddResponsible(actionId);
  const removeResponsible = useRemoveResponsible(actionId);

  const { columns } = useColumnsByWorkspace(action?.workspaceId ?? "");
  const { members } = useWorkspaceMembers(action?.workspaceId ?? "");

  const handleUpdateAction = (data: any) => {
    updateAction.mutate(
      { actionId, ...data },
      { onError: () => toast.error("Erro ao atualizar ação") },
    );
  };

  const handleToggleDone = () => {
    handleUpdateAction({ isDone: !action?.isDone });
  };

  const handleAddSubAction = (title: string) => {
    createSubAction.mutate(
      { actionId, title },
      { onError: () => toast.error("Erro ao criar sub-ação") },
    );
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

  const handleToggleParticipant = (userId: string) => {
    const isResponsible = action?.participants.some(
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Visualizar e editar ação</DialogTitle>
      <DialogContent
        className="p-0 sm:max-w-[90%] bg-muted overflow-hidden flex flex-col max-h-[90vh] gap-0"
        showCloseButton={false}
      >
        <ActionHeader
          workspaceName={action?.workspace?.name}
          actionTitle={action?.title}
          isLoading={isLoading}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                <ActionTitle
                  action={action}
                  onToggleDone={handleToggleDone}
                  onUpdateTitle={(title) => handleUpdateAction({ title })}
                  isUpdating={updateAction.isPending}
                />

                <ActionDescription
                  description={action?.description}
                  onDescriptionChange={(description) => handleUpdateAction({ description })}
                />

                <ActionSubActions
                  subActions={action?.subActions}
                  onCreate={handleAddSubAction}
                  onToggle={handleToggleSubAction}
                  onDelete={handleDeleteSubAction}
                  isCreating={createSubAction.isPending}
                  isDeleting={deleteSubAction.isPending}
                />
              </>
            )}
          </div>

          <ActionSidebar
            action={action}
            isLoading={isLoading}
            columns={columns}
            members={members}
            onUpdateAction={handleUpdateAction}
            onToggleParticipant={handleToggleParticipant}
            isUpdating={updateAction.isPending}
            isAddingParticipant={addResponsible.isPending}
            isRemovingParticipant={removeResponsible.isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
