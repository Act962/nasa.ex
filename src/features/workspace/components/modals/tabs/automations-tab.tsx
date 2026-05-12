"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, PlusIcon, WorkflowIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import {
  useCreateWorkspaceWorkflow,
  useSuspenseWorkspaceWorkflows,
  useUpdateWorkspaceWorkflowIsActive,
} from "@/features/workspace-editor/hooks/use-workspace-workflows";
import { getWorkflowStepsPreview } from "@/features/workspace/lib/workflow-preview";
import { cn } from "@/lib/utils";

export function AutomationsTab({ workspaceId }: { workspaceId: string }) {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">
          Carregando automações...
        </div>
      }
    >
      <AutomationsTabContent workspaceId={workspaceId} />
    </Suspense>
  );
}

function AutomationsTabContent({ workspaceId }: { workspaceId: string }) {
  const {
    data: { workflows },
  } = useSuspenseWorkspaceWorkflows(workspaceId);
  const create = useCreateWorkspaceWorkflow();
  const updateIsActive = useUpdateWorkspaceWorkflowIsActive(workspaceId);
  const router = useRouter();

  const handleCreate = async () => {
    if (create.isPending) return;
    const res = await create.mutateAsync({
      workspaceId,
      name: "Sem título",
    });
    router.push(`/workspaces/${workspaceId}/automations/${res.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-medium">Automações</h3>
          <p className="text-sm text-muted-foreground">
            Workflows que rodam automaticamente neste workspace.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={create.isPending}
        >
          <PlusIcon className="size-4" />
          {create.isPending ? "Criando..." : "Nova automação"}
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WorkflowIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma automação configurada</EmptyTitle>
            <EmptyDescription>
              Crie uma automação para agilizar seu fluxo de trabalho.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={handleCreate} disabled={create.isPending}>
              <PlusIcon className="size-4" />
              {create.isPending ? "Criando..." : "Criar automação"}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {workflows.map((wf) => {
            const { labels, total } = getWorkflowStepsPreview(
              wf.nodes,
              wf.connections,
              5,
            );
            const description =
              labels.length === 0
                ? "Sem passos configurados"
                : labels.join(" → ") + (total > labels.length ? " → …" : "");

            return (
              <div
                key={wf.id}
                className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60"
              >
                <div
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    wf.isActive ? "bg-emerald-500" : "bg-muted-foreground",
                  )}
                />
                <Link
                  href={`/workspaces/${workspaceId}/automations/${wf.id}`}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {wf.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {wf.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {description}
                  </p>
                </Link>
                <Switch
                  checked={wf.isActive}
                  disabled={updateIsActive.isPending}
                  onCheckedChange={(checked) =>
                    updateIsActive.mutate({
                      workflowId: wf.id,
                      isActive: checked,
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                  aria-label={
                    wf.isActive ? "Desativar automação" : "Ativar automação"
                  }
                />
                <Link
                  href={`/workspaces/${workspaceId}/automations/${wf.id}`}
                  aria-label="Abrir automação"
                  className="shrink-0"
                >
                  <ArrowUpRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
