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
  AlertTriangleIcon,
  FolderInputIcon,
  MoreVerticalIcon,
  WorkflowIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getWorkflowStepsPreview } from "../lib/workflow-preview";
import { validateWorkflow } from "../lib/validate-node";
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

  // Validação do workflow: roda em todos os nodes. Toggle "Ativo" só liga
  // quando todos passam. Inativo continua possível mesmo com erros — não
  // queremos forçar campos enquanto user ainda está montando.
  const validation = useMemo(
    () => validateWorkflow(workflow.nodes as any[]),
    [workflow.nodes],
  );
  const canActivate = validation.valid;

  const otherFolders = (foldersData?.folders ?? []).filter(
    (f) => f.id !== currentFolderId,
  );

  // Cor do contorno + ícone baseada em (isActive, canActivate):
  //  - Ativo + válido  → verde (rodando OK)
  //  - Inativo + válido → cinza neutro (pronto pra ativar)
  //  - Inativo + inválido → vermelho (campos faltando)
  //  - Ativo + inválido (não deveria acontecer mas defensivo) → âmbar
  const status: "active" | "ready" | "broken" | "warning" =
    workflow.isActive && canActivate
      ? "active"
      : workflow.isActive && !canActivate
        ? "warning"
        : !workflow.isActive && canActivate
          ? "ready"
          : "broken";

  const statusStyles = {
    active: {
      ring: "ring-1 ring-emerald-500/40",
      bg: "bg-emerald-500/10 text-emerald-600",
      badge: "bg-emerald-500/10 text-emerald-600",
      label: "Ativo",
    },
    ready: {
      ring: "",
      bg: "bg-muted text-muted-foreground",
      badge: "bg-muted text-muted-foreground",
      label: "Inativo",
    },
    broken: {
      ring: "ring-1 ring-red-500/50",
      bg: "bg-red-500/10 text-red-600",
      badge: "bg-red-500/10 text-red-600",
      label: "Incompleto",
    },
    warning: {
      ring: "ring-1 ring-amber-500/50",
      bg: "bg-amber-500/10 text-amber-600",
      badge: "bg-amber-500/10 text-amber-600",
      label: "Atenção",
    },
  }[status];

  return (
    <Item variant="outline" className={statusStyles.ring}>
      <ItemMedia>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            statusStyles.bg,
          )}
        >
          {status === "broken" ? (
            <AlertTriangleIcon className="size-4" />
          ) : (
            <WorkflowIcon className="size-4" />
          )}
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
              statusStyles.badge,
            )}
          >
            {statusStyles.label}
          </span>
        </div>
        <ItemDescription className="truncate">
          {!canActivate && (
            <span className="text-red-600 font-medium">
              {validation.blockingNodes.length} node(s) com campos faltando ·{" "}
            </span>
          )}
          {description}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(!canActivate && "cursor-not-allowed")}>
                <Switch
                  checked={workflow.isActive}
                  disabled={
                    updateIsActive.isPending ||
                    (!workflow.isActive && !canActivate)
                  }
                  onCheckedChange={(checked) => {
                    if (checked && !canActivate) {
                      const first = validation.blockingNodes[0];
                      toast.error(
                        `Não dá pra ativar: "${first.name}" precisa de ${first.errors.join(", ")}`,
                      );
                      return;
                    }
                    updateIsActive.mutate({
                      workflowId: workflow.id,
                      isActive: checked,
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={
                    workflow.isActive ? "Desativar automação" : "Ativar automação"
                  }
                />
              </span>
            </TooltipTrigger>
            {!canActivate && (
              <TooltipContent side="left" className="max-w-xs">
                <p className="font-semibold mb-1">
                  Não dá pra ativar — campos faltando:
                </p>
                <ul className="text-xs space-y-1">
                  {validation.blockingNodes.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      <b>{n.name}:</b> {n.errors.join(", ")}
                    </li>
                  ))}
                  {validation.blockingNodes.length > 5 && (
                    <li className="text-muted-foreground italic">
                      +{validation.blockingNodes.length - 5} outros…
                    </li>
                  )}
                </ul>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
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
