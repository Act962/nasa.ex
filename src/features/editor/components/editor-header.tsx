"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteWorkflow,
  useSuspenseWorkflow,
  useUpdateWorkflow,
  useUpdateWorkflowIsActive,
  useUpdateWorkflowName,
} from "@/features/workflows/hooks/use-workflows";
import { useAtomValue, useSetAtom } from "jotai";
import { SaveIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  editorAtom,
  lastSavedSnapshotAtom,
  workflowDirtyAtom,
} from "../store/atoms";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const EditorOptions = ({ workflowId }: { workflowId: string }) => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const deleteWorkflow = useDeleteWorkflow();

  const handleDelete = () => {
    deleteWorkflow.mutate(
      { id: workflowId },
      {
        onSuccess: () => {
          setOpen(false);
          router.push(`/tracking/${trackingId}/workflows`);
        },
      },
    );
  };

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        className="cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4 text-red-500" />
      </Button>
      {/* <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => setOpen(true)}
          >
            Deletar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu> */}

      <DeleteWorkflowDialog
        open={open}
        onOpenChange={setOpen}
        onDelete={handleDelete}
      />
    </>
  );
};

/**
 * Snapshot pra comparar com `lastSavedSnapshotAtom`. Espelha a função
 * `computeSignature` do editor.tsx — qualquer mudança aqui precisa ser
 * espelhada lá pra dirty-detection bater.
 */
type SerializableNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: unknown;
};
type SerializableEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
const computeWorkflowSignature = (
  nodes: SerializableNode[],
  edges: SerializableEdge[],
): string => {
  const cleanNodes = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }));
  const cleanEdges = edges.map((e) => ({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  }));
  return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
};

export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
  const editor = useAtomValue(editorAtom);
  const setLastSavedSnapshot = useSetAtom(lastSavedSnapshotAtom);
  const setDirty = useSetAtom(workflowDirtyAtom);
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) return;

    const nodes = editor.getNodes();
    const edges = editor.getEdges();

    saveWorkflow.mutate(
      {
        id: workflowId,
        nodes,
        edges,
      },
      {
        onSuccess: () => {
          // Atualiza baseline → o useEffect do editor.tsx detecta a
          // igualdade e seta dirty=false. Limpa flag de sessionStorage
          // pra `beforeunload` parar de alertar.
          setLastSavedSnapshot(computeWorkflowSignature(nodes, edges));
          setDirty(false);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("__wf_dirty", "false");
          }
        },
      },
    );
  };

  return (
    <Button onClick={handleSave} size={"sm"} disabled={saveWorkflow.isPending}>
      <SaveIcon className="size-4" />
      Salvar
    </Button>
  );
};

export const EditorNameInput = ({ workflowId }: { workflowId: string }) => {
  const {
    data: { workflow },
  } = useSuspenseWorkflow(workflowId);
  const updateWorkflow = useUpdateWorkflowName();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(workflow.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workflow.name) {
      setName(workflow.name);
    }
  }, [workflow.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (name === workflow.name) {
      setIsEditing(false);
      return;
    }

    try {
      await updateWorkflow.mutateAsync({
        workflowId,
        name,
      });
    } catch {
      setName(workflow.name);
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setName(workflow.name);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        disabled={updateWorkflow.isPending}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 w-auto min-w-25 px-2"
      />
    );
  }

  return (
    <BreadcrumbItem
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:text-foreground transition-colors"
    >
      {workflow.name}
    </BreadcrumbItem>
  );
};

export const EditorBreadcrumbs = ({ workflowId }: { workflowId: string }) => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const router = useRouter();
  const dirty = useAtomValue(workflowDirtyAtom);
  const editor = useAtomValue(editorAtom);
  const setLastSavedSnapshot = useSetAtom(lastSavedSnapshotAtom);
  const setDirty = useSetAtom(workflowDirtyAtom);
  const saveWorkflow = useUpdateWorkflow();
  const [dialogOpen, setDialogOpen] = useState(false);

  const backHref = `/tracking/${trackingId}/workflows`;

  const handleBackClick = (e: React.MouseEvent) => {
    if (!dirty) return; // fluxo normal — Link navega
    e.preventDefault();
    setDialogOpen(true);
  };

  const proceedToBack = () => {
    setDialogOpen(false);
    // Limpa flag pra `beforeunload` não disparar durante a navegação.
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("__wf_dirty", "false");
    }
    setDirty(false);
    router.push(backHref);
  };

  const handleSaveAndProceed = () => {
    if (!editor) {
      proceedToBack();
      return;
    }
    const nodes = editor.getNodes();
    const edges = editor.getEdges();
    saveWorkflow.mutate(
      { id: workflowId, nodes, edges },
      {
        onSuccess: () => {
          setLastSavedSnapshot(computeWorkflowSignature(nodes, edges));
          proceedToBack();
        },
      },
    );
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={backHref} onClick={handleBackClick}>
              Automações
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <UnsavedChangesDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaveAndProceed={handleSaveAndProceed}
          onDiscardAndProceed={proceedToBack}
          saving={saveWorkflow.isPending}
        />
        <EditorNameInput workflowId={workflowId} />
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const EditorActiveToggle = ({ workflowId }: { workflowId: string }) => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const { data } = useSuspenseWorkflow(workflowId);
  const isActive = data.workflow.isActive;
  const updateIsActive = useUpdateWorkflowIsActive(trackingId);

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{isActive ? "Ativa" : "Inativa"}</span>
      <Switch
        checked={isActive}
        disabled={updateIsActive.isPending}
        onCheckedChange={(checked) =>
          updateIsActive.mutate({ workflowId, isActive: checked })
        }
        aria-label={isActive ? "Desativar automação" : "Ativar automação"}
      />
    </label>
  );
};

export const EditorHeader = ({ workflowId }: { workflowId: string }) => {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4 bg-background">
      <EditorBreadcrumbs workflowId={workflowId} />
      <div className="flex items-center gap-2">
        <EditorActiveToggle workflowId={workflowId} />
        <EditorOptions workflowId={workflowId} />
        <EditorSaveButton workflowId={workflowId} />
      </div>
    </div>
  );
};

interface DeleteWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

export const DeleteWorkflowDialog = ({
  open,
  onOpenChange,
  onDelete,
}: DeleteWorkflowProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar workflow</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja deletar este workflow?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => onDelete()}>
            Deletar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
