"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CreateWorkflowButton } from "./create-workflow";
import {
  useSuspenseWorkflows,
  useUpdateWorkflowIsActive,
} from "@/features/workflows/hooks/use-workflows";
import { getWorkflowStepsPreview } from "@/features/workflows/lib/workflow-preview";
import { cn } from "@/lib/utils";

export function WorkflowContainer() {
  const { trackingId } = useParams<{ trackingId: string }>();

  const { data, isPending } = useSuspenseWorkflows(trackingId);
  const updateIsActive = useUpdateWorkflowIsActive(trackingId);

  if (isPending) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-2 mb-8">
      {data.workflows.length > 0 ? (
        data.workflows.map((workflow) => {
          const { labels, total } = getWorkflowStepsPreview(
            workflow.nodes,
            workflow.connections,
            5,
          );
          const description =
            labels.length === 0
              ? workflow.description || "Sem passos configurados"
              : labels.join(" → ") + (total > labels.length ? " → …" : "");

          return (
            <Item key={workflow.id} variant="outline">
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
                  <Link
                    href={`/tracking/${trackingId}/workflows/${workflow.id}`}
                  >
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
                <ItemDescription className="truncate">
                  {description}
                </ItemDescription>
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
                    workflow.isActive
                      ? "Desativar automação"
                      : "Ativar automação"
                  }
                />
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={`/tracking/${trackingId}/workflows/${workflow.id}`}
                  >
                    Ver
                  </Link>
                </Button>
              </ItemActions>
            </Item>
          );
        })
      ) : (
        <EmptyWorkflows />
      )}
    </div>
  );
}

function EmptyWorkflows() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WorkflowIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhum workflow encontrado</EmptyTitle>
        <EmptyDescription>
          Crie um workflow para começar a monitorar o progresso do seu projeto.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateWorkflowButton />
      </EmptyContent>
    </Empty>
  );
}
