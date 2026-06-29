"use client";

/**
 * Painel "Problemas do fluxo" — drawer lateral. Lista todos os issues do
 * workflow (estruturais + por nó) agrupados por severidade. Click numa
 * issue com `nodeId` centraliza/seleciona o nó no canvas via
 * `useReactFlow().fitView`.
 *
 * Diferente do Rocket-run (que faz preflight runtime), este painel só
 * mostra coisas que já carregamos via `workflow.validate` — não dispara
 * checks novos quando user abre.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { useWorkflowValidation } from "@/features/workflows/hooks/use-workflow-validation";
import type { GraphIssue } from "@/features/workflows/lib/validate-workflow-graph";

const CODE_LABEL: Record<string, string> = {
  NO_TRIGGER: "Sem gatilho",
  TRIGGER_DISCONNECTED: "Gatilho solto",
  ORPHAN_NODE: "Nó solto",
  UNREACHABLE_NODE: "Inalcançável",
  AI_DECISION_MISSING_BRANCH: "Branch faltando",
  SWITCH_CASE_MISSING_BRANCH: "Case faltando",
  IF_CONDITION_MISSING_OUTPUT: "Saída faltando",
  MERGE_UNDER_FED: "Merge sem 2 entradas",
  WAIT_FOR_EVENT_DEAD_END: "Wait sem saída",
  CYCLE_UNSAFE: "Loop infinito",
  ARCHIVED_TAG: "Tag arquivada",
  DELETED_TAG: "Tag deletada",
};

export function WorkflowIssuesPanel({ workflowId }: { workflowId: string }) {
  const [open, setOpen] = useState(false);
  const { fitView } = useReactFlow();
  const { data } = useWorkflowValidation(workflowId);

  // Runs com falha nas últimas 24h — auto-refresh enquanto o painel
  // está aberto. Só pega quando user abre o Sheet (`enabled: open`) pra
  // não rodar query pesada o tempo todo.
  const { data: runsData } = useQuery({
    ...orpc.workflow.listRuns.queryOptions({
      input: { workflowId, limit: 30 },
    }),
    enabled: open,
    refetchInterval: open ? 10_000 : false,
    staleTime: 5_000,
  });

  const failedRuns = useMemo(() => {
    if (!runsData?.runs) return [];
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return runsData.runs.filter(
      (r) =>
        (r.status === "FAILED" || r.status === "MAX_EXECUTIONS_HIT") &&
        new Date(r.startedAt).getTime() >= since,
    );
  }, [runsData?.runs]);

  const all = data?.graphIssues ?? [];
  const errors = all.filter((i) => i.severity === "error");
  const warnings = all.filter((i) => i.severity === "warning");
  const totalCount = errors.length + warnings.length + failedRuns.length;

  const handleFocus = (nodeId: string | null) => {
    if (!nodeId) return;
    fitView({ nodes: [{ id: nodeId }], duration: 600, padding: 0.3 });
    setOpen(false);
  };

  // Estado visual do badge — vermelho se tem erro, amarelo se só warnings.
  const badgeVariant: "destructive" | "secondary" | "outline" =
    errors.length > 0
      ? "destructive"
      : warnings.length > 0
        ? "secondary"
        : "outline";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-background gap-1.5"
        onClick={() => setOpen(true)}
      >
        {totalCount === 0 ? (
          <ShieldCheckIcon className="size-3.5 text-emerald-600" />
        ) : errors.length > 0 ? (
          <AlertCircleIcon className="size-3.5 text-destructive" />
        ) : (
          <AlertTriangleIcon className="size-3.5 text-yellow-600" />
        )}
        Problemas
        {totalCount > 0 && (
          <Badge variant={badgeVariant} className="text-[10px] px-1.5">
            {totalCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex flex-wrap items-center gap-2">
              Problemas do fluxo
              {errors.length > 0 && (
                <Badge variant="destructive">
                  {errors.length} erro{errors.length === 1 ? "" : "s"}
                </Badge>
              )}
              {warnings.length > 0 && (
                <Badge variant="secondary">
                  {warnings.length} aviso{warnings.length === 1 ? "" : "s"}
                </Badge>
              )}
              {failedRuns.length > 0 && (
                <Badge variant="destructive" className="bg-red-700">
                  {failedRuns.length} run
                  {failedRuns.length === 1 ? "" : "s"} falhou
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Estrutura do grafo, conexões e referências externas (tags,
              instâncias) verificadas em tempo real. Clique numa entrada pra
              focar o nó no canvas.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4 space-y-4">
            {totalCount === 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center text-sm text-emerald-700 dark:text-emerald-300">
                <ShieldCheckIcon className="size-6 mx-auto mb-1" />
                Tudo certo — nenhum problema estrutural detectado.
              </div>
            )}

            {errors.length > 0 && (
              <IssueGroup
                title="Erros bloqueantes"
                tone="error"
                issues={errors}
                onFocus={handleFocus}
              />
            )}

            {warnings.length > 0 && (
              <IssueGroup
                title="Avisos"
                tone="warning"
                issues={warnings}
                onFocus={handleFocus}
              />
            )}

            {/* Runs com falha — últimas 24h. Lista cada run com timestamp +
                errorMessage (que agora vem classificado pelo parseAiError
                quando é falha de LLM, ex: "[QUOTA_EXCEEDED] Conta sem
                crédito..."). Click NÃO foca nó porque a run pode ter
                falhado em vários — abre detalhe da run no futuro (TODO). */}
            {failedRuns.length > 0 && <FailedRunsGroup runs={failedRuns} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── FailedRunsGroup ──────────────────────────────────────────────
function FailedRunsGroup({
  runs,
}: {
  runs: Array<{
    id: string;
    status: string;
    triggerType: string;
    errorMessage: string | null;
    startedAt: Date | string;
    nodesExecuted: number;
  }>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide font-semibold text-destructive flex items-center gap-1.5">
        <PlayCircleIcon className="size-3.5" />
        Runs com falha (24h)
      </div>
      {runs.map((run) => {
        const time = new Date(run.startedAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        // Extrai código tipo [QUOTA_EXCEEDED] do início do errorMessage
        // pra destacar como badge separada.
        const match = run.errorMessage?.match(/^\[([A-Z_]+)\]\s*(.*)$/);
        const code = match?.[1] ?? null;
        const msg = match?.[2] ?? run.errorMessage ?? "Falha sem detalhe";
        return (
          <div
            key={run.id}
            className="w-full text-left rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge variant="destructive" className="text-[10px]">
                {code ?? run.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {time}
              </span>
            </div>
            <p className="text-xs">{msg}</p>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                Trigger: <span className="font-mono">{run.triggerType}</span>
              </span>
              <span>{run.nodesExecuted} nós executados</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IssueGroup({
  title,
  tone,
  issues,
  onFocus,
}: {
  title: string;
  tone: "error" | "warning";
  issues: GraphIssue[];
  onFocus: (nodeId: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "text-xs uppercase tracking-wide font-semibold",
          tone === "error" ? "text-destructive" : "text-yellow-700 dark:text-yellow-400",
        )}
      >
        {title}
      </div>
      {issues.map((issue, i) => (
        <button
          key={`${issue.code}-${issue.nodeId ?? "global"}-${i}`}
          type="button"
          onClick={() => onFocus(issue.nodeId)}
          disabled={!issue.nodeId}
          className={cn(
            "w-full text-left rounded-md border p-3 transition-colors",
            tone === "error"
              ? "border-destructive/40 hover:bg-destructive/5"
              : "border-yellow-300/60 hover:bg-yellow-50 dark:hover:bg-yellow-950/20",
            !issue.nodeId && "opacity-80 cursor-default",
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <Badge
              variant={tone === "error" ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {CODE_LABEL[issue.code] ?? issue.code}
            </Badge>
            {issue.nodeId && (
              <ArrowRightIcon className="size-3.5 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-foreground/90">{issue.message}</p>
        </button>
      ))}
    </div>
  );
}
