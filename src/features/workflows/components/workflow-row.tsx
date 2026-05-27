"use client";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderInputIcon,
  MoreVerticalIcon,
  WorkflowIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getWorkflowStepsPreview } from "../lib/workflow-preview";
import {
  useMoveWorkflowToFolder,
  useWorkflowFolders,
} from "../hooks/use-workflow-folders";
import { useUpdateWorkflowIsActive } from "../hooks/use-workflows";
import type { Connection, Node, Workflow } from "@/generated/prisma/client";

interface Props {
  workflow: Workflow & { nodes: Node[]; connections: Connection[] };
  trackingId: string;
  /** Folder atual (pra esconder do menu "Mover para"). */
  currentFolderId: string | null;
}

export function WorkflowRow({ workflow, trackingId, currentFolderId }: Props) {
  const { data: foldersData } = useWorkflowFolders(trackingId);
  const moveToFolder = useMoveWorkflowToFolder(trackingId);
  const updateIsActive = useUpdateWorkflowIsActive(trackingId);

  const { labels, total } = getWorkflowStepsPreview(
    workflow.nodes,
    workflow.connections,
    5,
  );
  const description =
    labels.length === 0
      ? workflow.description || "Sem passos configurados"
      : labels.join(" → ") + (total > labels.length ? " → …" : "");

  const otherFolders = (foldersData?.folders ?? []).filter(
    (f) => f.id !== currentFolderId,
  );

  return (
    <Item variant="outline">
      <ItemMedia>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            workflow.isActive
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-muted text-muted-foreground",
          )}
        >
          <WorkflowIcon className="size-4" />
        </div>
      </ItemMedia>
      <ItemContent>
        <div className="flex items-center gap-2">
          <Link href={`/tracking/${trackingId}/workflows/${workflow.id}`}>
            <ItemTitle className="hover:underline underline-offset-3">
              {workflow.name}
            </ItemTitle>
          </Link>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
              workflow.isActive
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground",
            )}
          >
            {workflow.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>
        <ItemDescription className="truncate">{description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          checked={workflow.isActive}
          disabled={updateIsActive.isPending}
          onCheckedChange={(checked) =>
            updateIsActive.mutate({
              workflowId: workflow.id,
              isActive: checked,
            })
          }
          onClick={(e) => e.stopPropagation()}
          aria-label={
            workflow.isActive ? "Desativar automação" : "Ativar automação"
          }
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label="Mais opções"
              disabled={moveToFolder.isPending}
            >
              <MoreVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
              <FolderInputIcon className="size-3.5" />
              Mover para
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {currentFolderId !== null && (
              <DropdownMenuItem
                onClick={() =>
                  moveToFolder.mutate({
                    workflowId: workflow.id,
                    folderId: null,
                  })
                }
              >
                <span className="text-muted-foreground">Sem pasta</span>
              </DropdownMenuItem>
            )}
            {otherFolders.length === 0 ? (
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">
                  Nenhuma outra pasta
                </span>
              </DropdownMenuItem>
            ) : (
              otherFolders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onClick={() =>
                    moveToFolder.mutate({
                      workflowId: workflow.id,
                      folderId: f.id,
                    })
                  }
                >
                  {f.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/tracking/${trackingId}/workflows/${workflow.id}`}>
            Ver
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}
