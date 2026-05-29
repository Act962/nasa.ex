"use client";

/**
 * Botão "Testar (dry-run)" — flutuante no Panel do canvas. Simula a
 * execução sem disparar side-effects e mostra timeline em Sheet lateral.
 *
 * Antes de simular, roda preflight (validate-workflow-graph + preflight-
 * workflow) — se tem erro de estrutura (órfão, tag arquivada, UAZAPI
 * desconectado), aborta e mostra só os problemas. Sem isso o user via
 * 1 nó falhar e ficava perdido sobre as 3 outras causas escondidas.
 *
 * Sheet tem 3 seções:
 *   🟥 Erros bloqueantes  (preflight.errors) — quando aborta
 *   🟨 Avisos             (preflight.warnings) — sempre que houver
 *   ▶ Timeline             (log)              — quando simulou
 *
 * Renderiza só quando `workflow.agentMode = true`.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  RocketIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useReactFlow } from "@xyflow/react";

interface DryRunResult {
  status: string;
  executions?: number;
  starsSpent?: number;
  cycleReport: {
    safe: boolean;
    warnings: string[];
    unsafeCount: number;
  } | null;
  preflight: {
    aborted: boolean;
    errors: Array<{ nodeId: string | null; code: string; message: string }>;
    warnings: Array<{ nodeId: string | null; code: string; message: string }>;
  };
  log: Array<{
    nodeId: string;
    type: string;
    chosenOutput: string;
    output: unknown;
    status: string;
    errorMessage?: string;
  }>;
}

export function DryRunButton({ workflowId }: { workflowId: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const { fitView } = useReactFlow();

  const dryRun = useMutation(
    orpc.workflow.dryRun.mutationOptions({
      onSuccess: (data) => {
        setResult(data as DryRunResult);
        setOpen(true);
        if (data.preflight?.aborted) {
          toast.error(
            `Teste abortado: ${data.preflight.errors.length} erro(s) bloqueante(s).`,
          );
        } else if (data.cycleReport && !data.cycleReport.safe) {
          toast.warning("Workflow tem ciclo sem nó de controle — revise!");
        }
      },
      onError: (err) => toast.error(`Dry-run falhou: ${err.message}`),
    }),
  );

  const focusNode = (nodeId: string | null) => {
    if (!nodeId) return;
    fitView({ nodes: [{ id: nodeId }], duration: 600, padding: 0.3 });
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={dryRun.isPending}
        onClick={() =>
          dryRun.mutate({ workflowId, triggerType: "MANUAL_TRIGGER" })
        }
        className="bg-background gap-1.5"
      >
        <RocketIcon className="size-3.5" />
        {dryRun.isPending ? "Testando…" : "Testar (Rocket-run)"}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Rocket-run
              {result && (
                <Badge
                  variant={
                    result.preflight?.aborted
                      ? "destructive"
                      : result.status === "DRY_RUN"
                        ? "default"
                        : "destructive"
                  }
                >
                  {result.preflight?.aborted
                    ? "ABORTADO"
                    : result.status}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {result?.preflight?.aborted
                ? "Pré-flight encontrou erros estruturais ou de ambiente. Corrija antes de simular."
                : "Simulação sem efeitos colaterais. Nada foi enviado ou cobrado."}
            </SheetDescription>
          </SheetHeader>

          {result && (
            <div className="px-4 pb-4 space-y-4">
              {/* Resumo (só quando simulou) */}
              {!result.preflight?.aborted && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border p-2">
                    <div className="font-bold text-lg">
                      {result.executions ?? 0}
                    </div>
                    <div className="text-muted-foreground">nós</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="font-bold text-lg">
                      {result.starsSpent ?? 0}
                    </div>
                    <div className="text-muted-foreground">★ (simulado)</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="font-bold text-lg">
                      {result.log.filter((l) => l.status === "FAILED").length}
                    </div>
                    <div className="text-muted-foreground">erros</div>
                  </div>
                </div>
              )}

              {/* 🟥 Erros bloqueantes */}
              {result.preflight?.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide font-semibold text-destructive">
                    Erros bloqueantes
                  </div>
                  {result.preflight.errors.map((e, i) => (
                    <button
                      key={`err-${i}`}
                      type="button"
                      onClick={() => focusNode(e.nodeId)}
                      disabled={!e.nodeId}
                      className="w-full text-left rounded-md border border-destructive/40 hover:bg-destructive/5 p-3 transition-colors disabled:cursor-default disabled:opacity-80"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircleIcon className="size-3.5 text-destructive" />
                        <Badge variant="destructive" className="text-[10px]">
                          {e.code}
                        </Badge>
                      </div>
                      <p className="text-xs">{e.message}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* 🟨 Avisos */}
              {result.preflight?.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide font-semibold text-yellow-700 dark:text-yellow-400">
                    Avisos
                  </div>
                  {result.preflight.warnings.map((w, i) => (
                    <button
                      key={`warn-${i}`}
                      type="button"
                      onClick={() => focusNode(w.nodeId)}
                      disabled={!w.nodeId}
                      className="w-full text-left rounded-md border border-yellow-300/60 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 p-3 transition-colors disabled:cursor-default disabled:opacity-80"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangleIcon className="size-3.5 text-yellow-600" />
                        <Badge variant="secondary" className="text-[10px]">
                          {w.code}
                        </Badge>
                      </div>
                      <p className="text-xs">{w.message}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Cycle warnings legados (loop sem controle) */}
              {result.cycleReport && !result.cycleReport.safe && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 p-3 space-y-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-yellow-700 dark:text-yellow-300">
                    <AlertCircleIcon className="size-4" />
                    Loop sem nó de controle detectado
                  </div>
                  {result.cycleReport.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-xs text-yellow-700 dark:text-yellow-200"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* ▶ Timeline da simulação */}
              {!result.preflight?.aborted && (
                <div className="space-y-2">
                  <div className="font-medium text-sm">
                    Timeline de execução
                  </div>
                  {result.log.map((step, i) => (
                    <div
                      key={i}
                      className="rounded-md border p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-medium">
                          <span className="text-muted-foreground">
                            #{i + 1}
                          </span>
                          <span>{step.type}</span>
                          {step.chosenOutput !== "main" && (
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              → {step.chosenOutput}
                            </Badge>
                          )}
                        </div>
                        {step.status === "FAILED" ? (
                          <AlertCircleIcon className="size-3.5 text-destructive" />
                        ) : (
                          <CheckCircleIcon className="size-3.5 text-emerald-600" />
                        )}
                      </div>
                      {step.errorMessage && (
                        <p className="text-destructive">
                          {step.errorMessage}
                        </p>
                      )}
                      {step.output != null && (
                        <details className="text-muted-foreground">
                          <summary className="cursor-pointer text-[10px] uppercase">
                            Output
                          </summary>
                          <pre className="mt-1 overflow-x-auto bg-muted/50 p-1 rounded text-[10px]">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                  {result.log.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum nó foi executado. Verifique se há trigger no
                      workflow.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
