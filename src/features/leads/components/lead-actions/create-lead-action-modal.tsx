"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useMutationCreateLeadAction } from "@/features/leads/hooks/use-lead-action";
import { useWorkspacesByTracking } from "@/features/workspace/hooks/use-workspace";

interface CreateLeadActionModalProps {
  leadId: string;
  leadName: string;
  trackingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Encadeia no card completo (ViewActionModal) após criar.
  onCreated?: (actionId: string) => void;
}

export function CreateLeadActionModal({
  leadId,
  leadName,
  trackingId,
  open,
  onOpenChange,
  onCreated,
}: CreateLeadActionModalProps) {
  const defaultTitle = `Atividade para o lead ${leadName}`;

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);

  const { data: workspaceData, isPending: isLoadingWorkspaces } =
    useWorkspacesByTracking(trackingId);
  const workspaces = workspaceData?.workspaces ?? [];
  const hasMultipleWorkspaces = workspaces.length > 1;

  const createAction = useMutationCreateLeadAction();

  // Ao (re)abrir, restaura o título padrão e pré-seleciona o 1º workspace
  // conectado — quando há só um, o seletor nem aparece.
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription("");
      setWorkspaceId(workspaces[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaces[0]?.id]);

  const isValid = title.trim().length >= 3;

  const onSubmit = () => {
    if (!isValid) return;
    createAction.mutate(
      {
        leadId,
        title: title.trim(),
        description: description.trim() || undefined,
        workspaceId,
        responsibles: [],
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          onCreated?.(data.action.id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nova atividade</DialogTitle>
          <DialogDescription>
            Cria uma atividade vinculada a {leadName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-action-title">Título</Label>
            <Input
              id="lead-action-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título da atividade"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-action-description">Descrição (opcional)</Label>
            <Textarea
              id="lead-action-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Detalhes da atividade..."
              className="min-h-20 resize-none"
            />
          </div>

          {hasMultipleWorkspaces && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-action-workspace">Workspace</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger id="lead-action-workspace">
                  <SelectValue placeholder="Selecione o workspace" />
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
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAction.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!isValid || createAction.isPending || isLoadingWorkspaces}
          >
            {createAction.isPending && <Spinner className="size-4" />}
            Criar atividade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
