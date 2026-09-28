"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichtTextEditor } from "@/components/rich-text-editor/editor-lazy";
import { ContainerItemLead } from "./container-item-lead";
import {
  useMutationCreateLeadAction,
  useQueryLeadAction,
} from "@/features/leads/hooks/use-lead-action";
import { useWorkspacesByTracking } from "@/features/workspace/hooks/use-workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface TabNotesProps {
  leadId: string;
  trackingId: string;
}

export function TabNotes({ leadId, trackingId }: TabNotesProps) {
  const { data, isLoading } = useQueryLeadAction({ leadId });
  const { data: workspacesData } = useWorkspacesByTracking(trackingId);
  const createAction = useMutationCreateLeadAction();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);

  const workspaces = workspacesData?.workspaces ?? [];
  const hasWorkspace = workspaces.length > 0;

  const onSubmit = () => {
    createAction.mutate(
      {
        leadId,
        title,
        description,
        workspaceId: workspaceId ?? workspaces[0]?.id,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription(undefined);
        },
      },
    );
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="w-full space-y-4 overflow-y-auto h-full">
      {!hasWorkspace ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Nenhum workspace conectado a este tracking. Vincule um workspace nas
          configurações dele para criar tarefas a partir do lead.
        </p>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="Título da tarefa"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={createAction.isPending}
          />

          {workspaces.length > 1 && (
            <Select
              value={workspaceId ?? workspaces[0]?.id}
              onValueChange={setWorkspaceId}
              disabled={createAction.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Workspace de destino" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.icon ? `${workspace.icon} ` : ""}
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <RichtTextEditor
            disabled={createAction.isPending}
            field={description}
            onChange={setDescription}
          >
            <Button
              className="ml-auto"
              onClick={onSubmit}
              disabled={title.trim().length < 3 || createAction.isPending}
            >
              {createAction.isPending ? "Criando..." : "Adicionar tarefa"}
            </Button>
          </RichtTextEditor>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {data?.actions.map((action) => (
          <ContainerItemLead
            key={action.id}
            {...action}
            trackingId={trackingId}
          />
        ))}
      </div>
      <div className="h-2" />
    </div>
  );
}
