/**
 * Executors de controle de fluxo (não-lógica pura — lógica fica built-in
 * no run-workflow.ts).
 *
 *  - WAIT_FOR_EVENT  — pausa execução até um evento Inngest específico
 *                      ser publicado (ex: "payment.received", "lead.replied").
 *                      Implementado como "sinalização": registra um waiter
 *                      em DB e devolve status=WAITING. O scheduler externo
 *                      (Inngest handler) re-dispara o workflow quando o
 *                      evento chega.
 *
 *  - CALL_WORKFLOW   — chama outro workflow como sub-rotina. Útil pra
 *                      reusar blocos (qualificação, follow-up, pós-venda).
 *                      Cap de profundidade: 5 níveis pra evitar recursão.
 */
import "server-only";
import prisma from "@/lib/prisma";
import { runWorkflow, type NodeExecutor } from "../run-workflow";
import { interpolate } from "../workflow-context";

const MAX_SUBWORKFLOW_DEPTH = 5;

// ─── WAIT_FOR_EVENT ────────────────────────────────
// data:
//   { eventNames: string[], timeoutMinutes: number }        (recomendado)
//   { eventName: string, timeoutMinutes: number }           (legado, mantido)
//
// `eventNames` permite RACE entre vários eventos — engine acorda no PRIMEIRO
// que chegar (via Promise.race no inngest/functions.ts). Pra retrocompat,
// `eventName: string` ainda é aceito e vira `[eventName]`.
//
// Implementação Fase 2: marca o run como WAITING e devolve eventNames no
// output. O run-workflow consome esse output, persiste SUSPENDED, e o caller
// Inngest faz os N step.waitForEvent em paralelo.
export const waitForEventExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  // Normaliza pra array: aceita ambos os formatos legacy/novo.
  const eventNamesRaw = data.eventNames ?? data.eventName;
  const eventNames: string[] = Array.isArray(eventNamesRaw)
    ? (eventNamesRaw as unknown[])
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
    : typeof eventNamesRaw === "string" && eventNamesRaw.trim()
      ? [eventNamesRaw.trim()]
      : [];
  const timeoutMinutes = Number(data.timeoutMinutes ?? 1440); // 24h default

  if (eventNames.length === 0) {
    return {
      output: { error: "eventNames vazio (precisa de ao menos 1)" },
      status: "FAILED",
      errorMessage: "eventNames ausentes",
    };
  }

  if (dryRun) {
    return {
      output: {
        waitedFor: eventNames,
        timeoutMinutes,
        dryRun: true,
      },
      chosenOutput: "main",
    };
  }

  // Fase 2: marca como WAITING e retorna; caller Inngest cuida do
  // step.waitForEvent (em paralelo se eventNames > 1, via Promise.race).
  return {
    output: {
      waiting: true,
      eventNames,
      timeoutMinutes,
      since: new Date().toISOString(),
    },
    chosenOutput: "main",
    status: "WAITING",
  };
};

// ─── CALL_WORKFLOW ─────────────────────────────────
// data: { workflowId: string, passContext?: boolean }
export const callWorkflowExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const workflowId = String(data.workflowId ?? "");
  const passContext = data.passContext !== false; // default true

  if (!workflowId) {
    return {
      output: { error: "workflowId obrigatório" },
      status: "FAILED",
      errorMessage: "workflowId ausente",
    };
  }

  // Anti-recursão: depth tracking via contexto
  const depth = Number(context.vars.__callDepth ?? 0);
  if (depth >= MAX_SUBWORKFLOW_DEPTH) {
    return {
      output: { error: `Profundidade máxima de sub-workflows (${MAX_SUBWORKFLOW_DEPTH}) atingida` },
      status: "FAILED",
      errorMessage: "max_depth_reached",
    };
  }

  // Carrega sub-workflow
  const subWorkflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, agentMode: true, isActive: true },
  });
  if (!subWorkflow) {
    return {
      output: { error: `Workflow ${workflowId} não encontrado` },
      status: "FAILED",
      errorMessage: "subworkflow_not_found",
    };
  }
  if (!subWorkflow.agentMode) {
    return {
      output: { error: "Sub-workflow precisa estar em Modo Agente IA" },
      status: "FAILED",
      errorMessage: "subworkflow_not_agent_mode",
    };
  }

  if (dryRun) {
    return {
      output: { dryRun: true, calledWorkflowId: workflowId, depth: depth + 1 },
    };
  }

  // Executa sub-workflow inline com profundidade +1. Sub-workflow herda
  // vars do parent quando passContext=true. Result do sub vai pra
  // vars.lastCallResult do parent.
  //
  // NOTA: chamadas sucessivas que entram em WAIT_FOR_EVENT no sub não
  // suspendem o parent (limitação Fase 5). Pra fluxo de proposta+follow-up
  // que precisa WAIT, mantenha tudo no mesmo workflow ou aceite que o sub
  // termine sem esperar.
  const { runWorkflow } = await import("../run-workflow");
  const { getAgentExecutorRegistry } = await import(
    "../agent-executor-registry"
  );

  const result = await runWorkflow(
    {
      workflowId,
      triggerType: "MANUAL_TRIGGER",
      leadId:
        typeof context.lead?.id === "string"
          ? (context.lead.id as string)
          : null,
      triggerPayload: passContext ? { ...context.vars } : {},
      initialVars: passContext
        ? { ...context.vars, __callDepth: depth + 1 }
        : { __callDepth: depth + 1 },
      dryRun: false,
    },
    getAgentExecutorRegistry(),
  );

  return {
    output: {
      callCompleted: true,
      subWorkflowId: workflowId,
      subRunId: result.runId,
      subStatus: result.status,
      subStarsSpent: result.starsSpent ?? 0,
      vars: {
        __callDepth: depth + 1,
        lastCallResult: result.status,
      },
    },
    starsSpent: result.starsSpent ?? 0,
    chosenOutput: "main",
  };
};
