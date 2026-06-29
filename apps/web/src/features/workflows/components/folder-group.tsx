"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkflowRow } from "./workflow-row";
import { CreateWorkflowButton } from "@/app/(platform)/(tracking)/tracking/[trackingId]/workflows/create-workflow";
import { FolderRenameDialog } from "./folder-rename-dialog";
import { useDeleteWorkflowFolder } from "../hooks/use-workflow-folders";
import type { Connection, Node, Workflow } from "@/generated/prisma/client";

interface Props {
  folderId: string | null; // null = "Sem pasta"
  folderName: string;
  workflowCount: number;
  workflows: (Workflow & { nodes: Node[]; connections: Connection[] })[];
  trackingId: string;
  /** Default open state. "Sem pasta" abre por padrão. */
  defaultOpen?: boolean;
}

export function FolderGroup({
  folderId,
  folderName,
  workflowCount,
  workflows,
  trackingId,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteFolder = useDeleteWorkflowFolder(trackingId);

  const isVirtual = folderId === null; // "Sem pasta" não tem CRUD
  const canDelete = !isVirtual && workflowCount === 0;

  return (
    <>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="rounded-lg border bg-card"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium hover:text-foreground/80 transition-colors flex-1 text-left">
              {open ? (
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              )}
              {open ? (
                <FolderOpenIcon
                  className={cn(
                    "size-4",
                    isVirtual ? "text-muted-foreground" : "text-amber-500",
                  )}
                />
              ) : (
                <FolderIcon
                  className={cn(
                    "size-4",
                    isVirtual ? "text-muted-foreground" : "text-amber-500",
                  )}
                />
              )}
              <span>{folderName}</span>
              <span className="text-xs text-muted-foreground">
                ({workflowCount})
              </span>
            </button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-1">
            <CreateWorkflowButton
              folderId={folderId}
              label="Automação"
              size="sm"
              variant="ghost"
            />
            {!isVirtual && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Mais opções da pasta"
                  >
                    <MoreVerticalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                    <PencilIcon className="size-3.5" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={!canDelete}
                    className={cn(
                      canDelete ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    <Trash2Icon className="size-3.5" />
                    {canDelete
                      ? "Excluir pasta"
                      : `Contém ${workflowCount} automação(ões)`}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t px-3 py-2 space-y-2">
            {workflows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {isVirtual
                  ? "Nenhuma automação fora de pasta."
                  : "Pasta vazia — clique em \"Automação\" pra criar a primeira."}
              </p>
            ) : (
              workflows.map((w) => (
                <WorkflowRow
                  key={w.id}
                  workflow={w}
                  trackingId={trackingId}
                  currentFolderId={folderId}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {!isVirtual && renameOpen && (
        <FolderRenameDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          trackingId={trackingId}
          folderId={folderId}
          currentName={folderName}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Excluir pasta?"
        description={`A pasta "${folderName}" será excluída. Workflows não serão afetados (essa pasta está vazia).`}
        confirmText="Excluir"
        isDangerous
        isLoading={deleteFolder.isPending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (!folderId) return;
          deleteFolder.mutate(
            { id: folderId },
            { onSuccess: () => setConfirmDeleteOpen(false) },
          );
        }}
      />
    </>
  );
}
