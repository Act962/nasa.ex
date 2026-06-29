"use client";

/**
 * Botão "Histórico" no Panel do canvas. Abre Sheet com 3 tabs:
 *  - Histórico: lista das últimas runs (WorkflowRun)
 *  - Logs: clique em uma run → timeline detalhada (WorkflowNodeRun)
 *  - Métricas: agregados 30d (taxa de sucesso, Stars, runs/hora)
 *
 * Renderiza só quando `workflow.agentMode = true`.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActivityIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PauseIcon,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, { cls: string; icon: typeof CheckCircleIcon }> = {
    SUCCESS: { cls: "bg-emerald-500/10 text-emerald-700 border-emerald-300", icon: CheckCircleIcon },
    FAILED: { cls: "bg-red-500/10 text-red-700 border-red-300", icon: AlertCircleIcon },
    SUSPENDED: { cls: "bg-amber-500/10 text-amber-700 border-amber-300", icon: PauseIcon },
    RUNNING: { cls: "bg-blue-500/10 text-blue-700 border-blue-300", icon: ActivityIcon },
    MAX_EXECUTIONS_HIT: { cls: "bg-red-500/10 text-red-700 border-red-300", icon: AlertCircleIcon },
    RATE_LIMITED: { cls: "bg-orange-500/10 text-orange-700 border-orange-300", icon: AlertCircleIcon },
  };
  const v = variant[status] ?? variant.SUCCESS;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={`text-[10px] ${v.cls}`}>
      <Icon className="size-3 mr-1" />
      {status}
    </Badge>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground/70 mt-1">{hint}</div>}
    </div>
  );
}

export function AgentDetailButton({ workflowId }: { workflowId: string }) {
  const [open, setOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsQuery = useQuery({
    ...orpc.workflow.listRuns.queryOptions({
      input: { workflowId, limit: 50 },
    }),
    enabled: open,
  });

  const runDetailQuery = useQuery({
    ...orpc.workflow.getRun.queryOptions({ input: { runId: selectedRunId ?? "" } }),
    enabled: open && !!selectedRunId,
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-background gap-1.5"
      >
        <ActivityIcon className="size-3.5" />
        Histórico
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Agente IA — Histórico & Métricas</SheetTitle>
            <SheetDescription>
              Últimas execuções, decisões IA e taxa de sucesso (30 dias).
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="historico" className="px-4 mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
              <TabsTrigger value="metricas" className="flex-1">Métricas</TabsTrigger>
            </TabsList>

            {/* HISTÓRICO */}
            <TabsContent value="historico" className="space-y-2 pt-4">
              {runsQuery.isLoading && (
                <>
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </>
              )}
              {selectedRunId ? (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRunId(null)}
                  >
                    <ArrowLeftIcon className="size-3.5" /> Voltar
                  </Button>
                  {runDetailQuery.isLoading && <Skeleton className="h-40" />}
                  {runDetailQuery.data && (
                    <div className="space-y-1">
                      <div className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            Run {runDetailQuery.data.id.slice(0, 8)}
                          </span>
                          <StatusBadge status={runDetailQuery.data.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Trigger: {runDetailQuery.data.triggerType} •{" "}
                          {runDetailQuery.data.nodesExecuted} nós •{" "}
                          {runDetailQuery.data.starsSpent} ★
                        </p>
                        {runDetailQuery.data.errorMessage && (
                          <p className="text-xs text-destructive">
                            {runDetailQuery.data.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        {runDetailQuery.data.nodeRuns.map((nr, i) => (
                          <div
                            key={nr.id}
                            className="rounded-md border p-2 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">#{i + 1}</span>
                                <span className="font-medium">{nr.nodeType}</span>
                                {nr.chosenOutput && nr.chosenOutput !== "main" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    → {nr.chosenOutput}
                                  </Badge>
                                )}
                              </div>
                              <StatusBadge status={nr.status} />
                            </div>
                            {nr.errorMessage && (
                              <p className="text-destructive">{nr.errorMessage}</p>
                            )}
                            {Boolean(nr.output) && (
                              <details className="text-muted-foreground">
                                <summary className="cursor-pointer text-[10px] uppercase">Output</summary>
                                <pre className="mt-1 bg-muted/50 p-1 rounded text-[10px] overflow-x-auto">
                                  {JSON.stringify(nr.output, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                runsQuery.data?.runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className="w-full rounded-lg border p-3 text-left hover:bg-accent transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={run.status} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {run.triggerType} • {run.nodesExecuted} nós • {run.starsSpent} ★
                        {run.leadId && ` • lead ${run.leadId.slice(0, 8)}`}
                      </p>
                    </div>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </button>
                ))
              )}
              {!selectedRunId && runsQuery.data?.runs.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-8">
                  Nenhuma execução ainda. Ative o workflow e crie um lead pra testar.
                </p>
              )}
            </TabsContent>

            {/* MÉTRICAS */}
            <TabsContent value="metricas" className="pt-4 space-y-3">
              {runsQuery.isLoading && (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              )}
              {runsQuery.data?.metrics && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard
                      label="Execuções (30d)"
                      value={runsQuery.data.metrics.totalRuns}
                    />
                    <MetricCard
                      label="Taxa de sucesso"
                      value={`${runsQuery.data.metrics.successRate.toFixed(1)}%`}
                      hint={`${runsQuery.data.metrics.successCount} de ${runsQuery.data.metrics.totalRuns}`}
                    />
                    <MetricCard
                      label="Stars (30d)"
                      value={runsQuery.data.metrics.totalStars}
                    />
                    <MetricCard
                      label="Nós executados"
                      value={runsQuery.data.metrics.totalNodes}
                      hint={`média ${runsQuery.data.metrics.avgNodesPerRun.toFixed(1)}/run`}
                    />
                    <MetricCard
                      label="Falhas"
                      value={runsQuery.data.metrics.failedCount}
                    />
                    <MetricCard
                      label="Em espera"
                      value={runsQuery.data.metrics.suspendedCount}
                      hint="WAIT_FOR_EVENT pendente"
                    />
                  </div>
                  <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-3">
                    <div className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                      Rate limit (sliding window 1h)
                    </div>
                    <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">
                      {runsQuery.data.metrics.runsLastHour} runs
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
