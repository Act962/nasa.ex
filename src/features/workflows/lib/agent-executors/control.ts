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
import { HANDOFF_MODE, MAX_HANDOFF_DEPTH } from "../flow-links";

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
    select: {
      id: true,
      name: true,
      agentMode: true,
      isActive: true,
      tracking: { select: { organizationId: true } },
      nodes: { select: { id: true, type: true } },
      connections: { select: { toNodeId: true } },
    },
  });
  if (!subWorkflow) {
    return {
      output: { error: `Workflow ${workflowId} não encontrado` },
      status: "FAILED",
      errorMessage: "subworkflow_not_found",
    };
  }
  // O id do fluxo de destino vem do desenho, que qualquer editor do funil pode alterar: só vale
  // fluxo da mesma empresa do lead (spec 0092).
  const leadTrackingId = typeof context.lead?.trackingId === "string" ? (context.lead.trackingId as string) : null;
  if (leadTrackingId && subWorkflow.tracking?.organizationId) {
    const leadTracking = await prisma.tracking.findUnique({ where: { id: leadTrackingId }, select: { organizationId: true } });
    if (leadTracking && leadTracking.organizationId !== subWorkflow.tracking.organizationId) {
      return {
        output: { error: `Workflow ${workflowId} não encontrado` },
        status: "FAILED",
        errorMessage: "subworkflow_not_found",
      };
    }
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

  // Modo passagem ("terminou um, roda o outro", spec 0092): em vez de rodar aqui dentro, dispara o
  // fluxo de destino como uma execução própria. Assim as esperas dele funcionam, o que não acontece
  // na chamada embutida abaixo. Só para quadros marcados com `mode: "handoff"`; os demais não mudam.
  if (data.mode === HANDOFF_MODE) {
    const handoffDepth = Number((context.trigger as { __handoffDepth?: unknown } | undefined)?.__handoffDepth ?? 0);
    if (handoffDepth >= MAX_HANDOFF_DEPTH) {
      return {
        output: { error: `Sequência de fluxos passou de ${MAX_HANDOFF_DEPTH} passagens` },
        status: "FAILED",
        errorMessage: "max_handoff_depth_reached",
      };
    }
    if (!subWorkflow.isActive) {
      return {
        output: { error: `O fluxo "${subWorkflow.name}" está desligado` },
        status: "FAILED",
        errorMessage: `O fluxo de destino "${subWorkflow.name}" está desligado. Ligue-o para a passagem acontecer.`,
      };
    }
    // O fluxo de destino começa pelo gatilho dele: é o tipo desse quadro que o motor procura.
    const nodesWithIncoming = new Set(subWorkflow.connections.map((connection) => connection.toNodeId));
    const entryNode = subWorkflow.nodes.find((node) => node.type !== "INITIAL" && !nodesWithIncoming.has(node.id));
    if (!entryNode) {
      return {
        output: { error: `O fluxo "${subWorkflow.name}" não tem gatilho` },
        status: "FAILED",
        errorMessage: `O fluxo de destino "${subWorkflow.name}" não tem por onde começar.`,
      };
    }
    const { sendWorkflowExecution } = await import("@/inngest/utils");
    await sendWorkflowExecution({
      workflowId,
      triggerType: entryNode.type as Parameters<typeof sendWorkflowExecution>[0]["triggerType"],
      leadId: typeof context.lead?.id === "string" ? (context.lead.id as string) : null,
      initialData: { __handoffDepth: handoffDepth + 1, handedOffFromWorkflow: true },
    });
    return { output: { handedOff: true, subWorkflowId: workflowId }, chosenOutput: "main" };
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
