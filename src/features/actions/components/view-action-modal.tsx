"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  useQueryAction,
  useUpdateAction,
  useDeleteAction,
  useCreateSubAction,
  useUpdateSubAction,
  useDeleteSubAction,
  useAddResponsible,
  useRemoveResponsible,
  useAddSubActionResponsible,
  useRemoveSubActionResponsible,
  usePromoteSubAction,
  useReorderSubActions,
  useCreateSubActionGroup,
  useUpdateSubActionGroup,
  useDeleteSubActionGroup,
  useReorderSubActionGroups,
  useAddParticipant,
  useRemoveParticipant,
} from "../hooks/use-tasks";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useColumnsByWorkspace,
  useWorkspaceMembers,
  useUpdateActionFields,
  useRemoveFileAction,
} from "@/features/workspace/hooks/use-workspace";
import { toast } from "sonner";
import { Action } from "../types";
import { ActionHeader } from "./view-modal/action-header";
import { ActionTitle } from "./view-modal/title";
import { ActionDescription } from "./view-modal/description";
import { ActionSubActions } from "./sub-actions";
import { AttachmentsSection } from "./view-modal/attachments-section";
import { LinksSection } from "./view-modal/links-section";
import { YoutubeSection } from "./view-modal/youtube-section";
import { CardActionsMenu } from "./card-actions-menu";
import { ActionSidebar } from "./view-modal/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ShieldAlert, HistoryIcon, PanelRightOpen } from "lucide-react";
import { HistoricSheet } from "./view-modal/historic-sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChatSection } from "./chat";
import { authClient } from "@/lib/auth-client";

interface Props {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewActionModal({ actionId, open, onOpenChange }: Props) {
  const { action: rawAction, hasAccess, isLoading } = useQueryAction(actionId);
  const action = (rawAction ?? undefined) as Action | undefined;
  const { data: session } = authClient.useSession();
  const [historicOpen, setHistoricOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const updateAction = useUpdateAction();
  const updateFields = useUpdateActionFields();
  const createSubAction = useCreateSubAction(actionId);
  const updateSubAction = useUpdateSubAction(actionId);
  const deleteSubAction = useDeleteSubAction(actionId);
  const addResponsible = useAddResponsible(actionId);
  const removeResponsible = useRemoveResponsible(actionId);
  const addParticipant = useAddParticipant(actionId);
  const removeParticipant = useRemoveParticipant(actionId);
  const addSubActionResponsible = useAddSubActionResponsible(actionId);
  const removeSubActionResponsible = useRemoveSubActionResponsible(actionId);
  const promoteSubAction = usePromoteSubAction(actionId);
  const reorderSubActions = useReorderSubActions(actionId);
  const createSubActionGroup = useCreateSubActionGroup(actionId);
  const updateSubActionGroup = useUpdateSubActionGroup(actionId);
  const deleteSubActionGroup = useDeleteSubActionGroup(actionId);
  const reorderSubActionGroups = useReorderSubActionGroups(actionId);
  const removeFileAction = useRemoveFileAction();

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

  const handleAddSubAction = (title: string, groupId?: string | null) => {
    createSubAction.mutate(
      { actionId, title, groupId: groupId ?? null },
      { onError: () => toast.error("Erro ao criar sub-ação") },
    );
  };

  const handleReorderSubActions = (
    items: { id: string; order: number; groupId: string | null }[],
  ) => {
    reorderSubActions.mutate(
      { actionId, items },
      { onError: () => toast.error("Erro ao reordenar sub-ações") },
    );
  };

  const handleCreateSubActionGroup = (name: string) => {
    createSubActionGroup.mutate(
      { actionId, name },
      { onError: () => toast.error("Erro ao criar pasta") },
    );
  };

  const handleUpdateSubActionGroup = (
    groupId: string,
    data: { name?: string; isOpen?: boolean },
  ) => {
    updateSubActionGroup.mutate(
      { groupId, ...data },
      { onError: () => toast.error("Erro ao atualizar pasta") },
    );
  };

  const handleDeleteSubActionGroup = (
    groupId: string,
    deleteSubActions: boolean = false,
  ) => {
    deleteSubActionGroup.mutate(
      { groupId, deleteSubActions },
      { onError: () => toast.error("Erro ao excluir pasta") },
    );
  };

  const handleReorderSubActionGroups = (
    items: { id: string; order: number }[],
  ) => {
    reorderSubActionGroups.mutate(
      { actionId, items },
      { onError: () => toast.error("Erro ao reordenar pastas") },
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

  const handleUpdateSubAction = (
    subActionId: string,
    data: {
      title?: string;
      description?: string | null;
      finishDate?: Date | null;
    },
  ) => {
    updateSubAction.mutate(
      { subActionId, ...data },
      { onError: () => toast.error("Erro ao atualizar sub-ação") },
    );
  };

  const handleAddSubActionResponsible = (
    subActionId: string,
    userId: string,
  ) => {
    addSubActionResponsible.mutate(
      { subActionId, userId },
      { onError: () => toast.error("Erro ao adicionar responsável") },
    );
  };

  const handleRemoveSubActionResponsible = (
    subActionId: string,
    userId: string,
  ) => {
    removeSubActionResponsible.mutate(
      { subActionId, userId },
      { onError: () => toast.error("Erro ao remover responsável") },
    );
  };

  const handlePromoteSubAction = (subActionId: string) => {
    promoteSubAction.mutate(
      { subActionId },
      {
        onSuccess: () => toast.success("Sub-ação transformada em ação"),
        onError: () => toast.error("Erro ao promover sub-ação"),
      },
    );
  };

  const handleToggleParticipant = (userId: string) => {
    const isParticipant = action?.participants.some(
      (r) => r.user.id === userId,
    );
    if (isParticipant) {
      removeParticipant.mutate(
        { actionId, userId },
        { onError: (error) => toast.error(error.message) },
      );
    } else {
      addParticipant.mutate(
        { actionId, userId },
        { onError: (error) => toast.error(error.message) },
      );
    }
  };

  const handleUpdateFields = (data: any) => {
    if (!action?.id) return;
    updateFields.mutate({ actionId: action.id, ...data });
  };

  const handleRemoveFile = (attachmentId: string) => {
    removeFileAction.mutate(
      { actionId, attachmentId },
      { onError: () => toast.error("Erro ao remover arquivo") },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only ">Visualizar e editar ação</DialogTitle>
      <DialogContent
        className="bg-muted flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-[90%] sm:rounded-lg"
        showCloseButton={false}
      >
        <ActionHeader
          workspaceName={hasAccess ? action?.workspace?.name : ""}
          actionTitle={hasAccess ? action?.title : "Sem permissão"}
          isLoading={isLoading}
          actionMenu={
            action && hasAccess ? (
              <CardActionsMenu
                actionId={action.id}
                workspaceId={action.workspaceId}
                isFavorited={action.isFavorited}
                isFavoritedByMe={(action as any).isFavoritedByMe}
                isArchived={action.isArchived}
                createdBy={action.createdBy}
                onClose={() => onOpenChange(false)}
              />
            ) : undefined
          }
          historyTrigger={
            action && hasAccess ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full hidden md:flex"
                onClick={() => setHistoricOpen(true)}
              >
                <HistoryIcon className="size-4" />
              </Button>
            ) : undefined
          }
          mobileSidebarTrigger={
            action && hasAccess ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                title="Detalhes"
              >
                <PanelRightOpen className="size-4" />
              </Button>
            ) : undefined
          }
        />

        <div className="flex flex-1 overflow-hidden">
          {!isLoading && action && !hasAccess ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center h-full w-full">
              <Empty className="border-none">
                <EmptyMedia variant="icon">
                  <ShieldAlert className="size-6 text-destructive" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Acesso Restrito</EmptyTitle>
                  <EmptyDescription>
                    Você não é participante deste evento. Os criadores ou
                    administradores devem adicionar você para visualizar os
                    detalhes.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 w-full px-6 min-w-0 ">
                <div className="space-y-6 my-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <ActionTitle
                          action={action}
                          onToggleDone={handleToggleDone}
                          onUpdateTitle={(title) =>
                            handleUpdateAction({ title })
                          }
                          isUpdating={updateAction.isPending}
                          isLoading={isLoading}
                          columns={columns}
                          members={members}
                          onUpdateAction={handleUpdateAction}
                          onUpdateFields={handleUpdateFields}
                          onToggleParticipant={handleToggleParticipant}
                          isUpdatingAction={updateAction.isPending}
                          isUpdatingFields={updateFields.isPending}
                          isAddingParticipant={addResponsible.isPending}
                          isRemovingParticipant={removeResponsible.isPending}
                        />
                      </div>

                      <ActionDescription
                        description={action?.description}
                        onDescriptionChange={(description) =>
                          handleUpdateAction({ description })
                        }
                      />

                      <AttachmentsSection
                        attachments={(action?.attachments ?? []) as any}
                        onUpdate={(attachments) =>
                          handleUpdateFields({ attachments })
                        }
                        onRemove={handleRemoveFile}
                        disabled={
                          updateFields.isPending || removeFileAction.isPending
                        }
                      />

                      <LinksSection
                        links={(action?.links ?? []) as any}
                        onUpdate={(links) => handleUpdateFields({ links })}
                        disabled={updateFields.isPending}
                      />

                      <YoutubeSection
                        youtubeUrl={action?.youtubeUrl ?? null}
                        onUpdate={(youtubeUrl) =>
                          handleUpdateFields({ youtubeUrl })
                        }
                        disabled={updateFields.isPending}
                      />

                      <ActionSubActions
                        subActions={action?.subActions}
                        subActionGroups={action?.subActionGroups}
                        members={members}
                        actionStartDate={action?.startDate ? new Date(action.startDate) : null}
                        actionDueDate={action?.dueDate ? new Date(action.dueDate) : null}
                        onCreate={handleAddSubAction}
                        onToggle={handleToggleSubAction}
                        onDelete={handleDeleteSubAction}
                        onUpdate={handleUpdateSubAction}
                        onAddResponsible={handleAddSubActionResponsible}
                        onRemoveResponsible={handleRemoveSubActionResponsible}
                        onPromote={handlePromoteSubAction}
                        onReorder={handleReorderSubActions}
                        onCreateGroup={handleCreateSubActionGroup}
                        onUpdateGroup={handleUpdateSubActionGroup}
                        onDeleteGroup={handleDeleteSubActionGroup}
                        onReorderGroups={handleReorderSubActionGroups}
                        isCreating={createSubAction.isPending}
                        isDeleting={deleteSubAction.isPending}
                        isUpdating={updateSubAction.isPending}
                      />

                      {action?.id && session?.user?.id && (
                        <ChatSection
                          actionId={action.id}
                          actionTitle={action.title ?? "Evento"}
                          currentUserId={session.user.id}
                        />
                      )}
                    </>
                  )}

                  <div className="pb-32" />
                </div>
              </ScrollArea>
              <div className="hidden w-[320px] shrink-0 lg:block">
                <ActionSidebar
                  action={action}
                  isLoading={isLoading}
                  columns={columns}
                  members={members}
                  onUpdateAction={handleUpdateAction}
                  onUpdateFields={handleUpdateFields}
                  onToggleParticipant={handleToggleParticipant}
                  isUpdating={updateAction.isPending}
                  isUpdatingFields={updateFields.isPending}
                  isAddingParticipant={addResponsible.isPending}
                  isRemovingParticipant={removeResponsible.isPending}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <HistoricSheet
        actionId={actionId}
        workspaceId={action?.workspaceId ?? ""}
        open={historicOpen}
        onOpenChange={setHistoricOpen}
      />

      {/* Mobile/tablet sidebar — abre centralizado na tela ocupando 95vw x 90vh.
          Em desktop (lg+) o sidebar já é renderizado inline. */}
      <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DialogContent
          className="flex h-[90dvh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-lg lg:hidden"
          showCloseButton
        >
          <DialogTitle className="border-b px-4 py-3 text-base">
            Detalhes
          </DialogTitle>
          <div className="flex-1 overflow-hidden">
            <ActionSidebar
              action={action}
              isLoading={isLoading}
              columns={columns}
              members={members}
              onUpdateAction={handleUpdateAction}
              onUpdateFields={handleUpdateFields}
              onToggleParticipant={handleToggleParticipant}
              isUpdating={updateAction.isPending}
              isUpdatingFields={updateFields.isPending}
              isAddingParticipant={addResponsible.isPending}
              isRemovingParticipant={removeResponsible.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
