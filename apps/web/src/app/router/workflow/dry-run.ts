/**
 * Dry-run de workflow em Modo Agente IA — simula a execução sem disparar
 * side-effects (não envia mensagens reais, não cobra Stars, não move lead,
 * não cria pagamentos). Retorna a timeline dos nodes executados + decisões
 * tomadas pela IA pra revisão visual antes de ativar.
 *
 * Usa o mesmo motor (`runWorkflow`) com flag `dryRun=true` — cada executor
 * respeita esse flag e devolve um output simulado.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { runWorkflow } from "@/features/workflows/lib/run-workflow";
import { getAgentExecutorRegistry } from "@/features/workflows/lib/agent-executor-registry";
import { detectCycles } from "@/features/workflows/lib/cycle-detector";
import { validateWorkflowGraph } from "@/features/workflows/lib/validate-workflow-graph";
import { preflightWorkflow } from "@/features/workflows/lib/preflight-workflow";
import z from "zod";

export const dryRunWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      /** Trigger a simular. Default "MANUAL_TRIGGER". */
      triggerType: z.string().optional(),
      /** Mock data do lead (apenas leitura — não toca no DB). */
      mockLead: z.record(z.string(), z.any()).optional(),
      /** Variáveis pré-populadas pra simulação. */
      mockVars: z.record(z.string(), z.any()).optional(),
    }),
  )
  .output(
    z.object({
      runId: z.string().nullable(),
      status: z.string(),
      executions: z.number().optional(),
      starsSpent: z.number().optional(),
      cycleReport: z
        .object({
          safe: z.boolean(),
          warnings: z.array(z.string()),
          unsafeCount: z.number(),
        })
        .nullable(),
      /**
       * Issues estruturais (`validate-workflow-graph`) + runtime (`preflight-
       * workflow`). Quando há `severity: "error"`, a simulação é abortada e
       * `log` fica vazio — UI mostra as 2 seções no topo do Sheet.
       */
      preflight: z.object({
        aborted: z.boolean(),
        errors: z.array(
          z.object({
            nodeId: z.string().nullable(),
            code: z.string(),
            message: z.string(),
          }),
        ),
        warnings: z.array(
          z.object({
            nodeId: z.string().nullable(),
            code: z.string(),
            message: z.string(),
          }),
        ),
      }),
      log: z.array(
        z.object({
          nodeId: z.string(),
          type: z.string(),
          chosenOutput: z.string(),
          output: z.unknown(),
          status: z.string(),
          errorMessage: z.string().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      select: {
        id: true,
        agentMode: true,
        isActive: true,
        nodes: { select: { id: true, type: true } },
        connections: { select: { fromNodeId: true, toNodeId: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    }
    if (!workflow.agentMode) {
      throw errors.BAD_REQUEST({
        message:
          "Dry-run só disponível em Modo Agente IA. Ative o toggle antes.",
      });
    }

    // 1. Cycle check estático (mantém pra compat com cycleReport no payload)
    const cycleReport = detectCycles(
      workflow.nodes.map((n) => ({ id: n.id, type: n.type })),
      workflow.connections.map((c) => ({
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
      })),
    );

    // 2. Preflight: combina validação de grafo + checks runtime (UAZAPI,
    //    AI key, placeholders inválidos, tracking arquivado). Se qualquer
    //    item severity:error → aborta simulação e retorna só os issues —
    //    user não devia gastar Stars (mesmo simulados) num workflow que
    //    já vai falhar antes do 1º nó.
    const graphValidation = await validateWorkflowGraph(input.workflowId);
    const preflightResult = await preflightWorkflow({
      workflowId: input.workflowId,
    });

    const allErrors = [
      ...graphValidation.issues
        .filter((i) => i.severity === "error")
        .map((i) => ({ nodeId: i.nodeId, code: i.code, message: i.message })),
      ...preflightResult.checks
        .filter((c) => c.severity === "error")
        .map((c) => ({ nodeId: c.nodeId, code: c.code, message: c.message })),
    ];
    const allWarnings = [
      ...graphValidation.issues
        .filter((i) => i.severity === "warning")
        .map((i) => ({ nodeId: i.nodeId, code: i.code, message: i.message })),
      ...preflightResult.checks
        .filter((c) => c.severity === "warning")
        .map((c) => ({ nodeId: c.nodeId, code: c.code, message: c.message })),
    ];

    if (allErrors.length > 0) {
      return {
        runId: null,
        status: "PREFLIGHT_FAILED",
        executions: 0,
        starsSpent: 0,
        cycleReport: {
          safe: cycleReport.safe,
          warnings: cycleReport.warnings,
          unsafeCount: cycleReport.unsafeCycles.length,
        },
        preflight: { aborted: true, errors: allErrors, warnings: allWarnings },
        log: [],
      };
    }

    // 3. Executa engine em modo dry-run (não persiste WorkflowRun)
    const result = await runWorkflow(
      {
        workflowId: input.workflowId,
        triggerType: input.triggerType ?? "MANUAL_TRIGGER",
        leadId: null,
        triggerPayload: { ...input.mockVars },
        initialVars: { ...input.mockVars, ...(input.mockLead ?? {}) },
        dryRun: true,
      },
      getAgentExecutorRegistry(),
    );

    return {
      runId: null,
      status: result.status,
      executions: result.executions ?? 0,
      starsSpent: result.starsSpent ?? 0,
      cycleReport: {
        safe: cycleReport.safe,
        warnings: cycleReport.warnings,
        unsafeCount: cycleReport.unsafeCycles.length,
      },
      preflight: { aborted: false, errors: [], warnings: allWarnings },
      log: (result.log ?? []).map((l) => ({
        nodeId: l.nodeId,
        type: l.type,
        chosenOutput: l.chosenOutput ?? "main",
        output: l.output,
        status: l.status ?? "SUCCESS",
        errorMessage: l.errorMessage,
      })),
    };
  });
