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
import { interpolate, isAttendanceFlowContext, type WorkflowContext } from "../workflow-context";
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
      kind: true,
      organizationId: true,
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
  // fluxo da mesma empresa do lead (spec 0092). Fluxo do FlowAstro é da empresa, sem funil (spec 0139, D-11).
  const leadTrackingId = typeof context.lead?.trackingId === "string" ? (context.lead.trackingId as string) : null;
  const subWorkflowOrganizationId = subWorkflow.organizationId ?? subWorkflow.tracking?.organizationId ?? null;
  if (leadTrackingId && subWorkflowOrganizationId) {
    const leadTracking = await prisma.tracking.findUnique({ where: { id: leadTrackingId }, select: { organizationId: true } });
    if (leadTracking && leadTracking.organizationId !== subWorkflowOrganizationId) {
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

  // Fluxo do FlowAstro só começa pelo Início, com a trava do lead: chamado de uma automação comum, rodaria sem gatilho
  // e não mandaria nada ao cliente. Melhor falhar dizendo o motivo.
  if (subWorkflow.kind === "ATTENDANCE" && !isAttendanceFlowContext(context)) {
    return failedHandoff(
      "attendance_flow_from_automation",
      `"${subWorkflow.name}" é um fluxo do FlowAstro e só pode ser conectado a partir de outro fluxo do FlowAstro.`,
    );
  }

  if (dryRun) {
    return {
      output: { dryRun: true, calledWorkflowId: workflowId, depth: depth + 1 },
    };
  }

  // FlowAstro para FlowAstro (spec 0139, CB-8): o destino ganha execução própria com a trava do lead.
  if (isAttendanceFlowContext(context) && subWorkflow.kind === "ATTENDANCE") {
    return handOffBetweenAttendanceFlows({ context, subWorkflow, subWorkflowOrganizationId });
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

type AttendanceTargetFlow = {
  id: string;
  name: string;
  isActive: boolean;
  nodes: { id: string; type: string }[];
};

/** `reason` é o código para filtrar nos logs; `userMessage` é o que a equipe lê no histórico da execução. */
function failedHandoff(reason: string, userMessage: string) {
  return { output: { error: userMessage, reason }, status: "FAILED" as const, errorMessage: userMessage };
}

/**
 * Passagem entre fluxos do FlowAstro: a execução atual termina e o destino começa pela Entrada dele, com a trava do
 * lead. A volta ao menu (A → B → A) é normal; só a passagem em sequência sem o cliente responder no meio é limitada.
 */
async function handOffBetweenAttendanceFlows(params: {
  context: WorkflowContext;
  subWorkflow: AttendanceTargetFlow;
  subWorkflowOrganizationId: string | null;
}) {
  const { context, subWorkflow } = params;
  const leadId = typeof context.lead?.id === "string" ? context.lead.id : null;
  const sourceWorkflowId = context.workflowId;
  if (!leadId || !sourceWorkflowId) return failedHandoff("attendance_handoff_without_lead", "A conexão de fluxo precisa de um contato.");

  const sourceWorkflow = await prisma.workflow.findUnique({ where: { id: sourceWorkflowId }, select: { organizationId: true } });
  if (!sourceWorkflow?.organizationId || sourceWorkflow.organizationId !== params.subWorkflowOrganizationId) {
    return failedHandoff("subworkflow_not_found", `O fluxo conectado (${subWorkflow.id}) não foi encontrado nesta empresa.`);
  }
  if (!subWorkflow.isActive) {
    return failedHandoff("subworkflow_inactive", `O fluxo conectado "${subWorkflow.name}" está desligado. Ligue-o para o cliente seguir nele.`);
  }
  if (!subWorkflow.nodes.some((node) => node.type === "ATTENDANCE_START")) {
    return failedHandoff("subworkflow_without_start", `O fluxo conectado "${subWorkflow.name}" não tem bloco de Início.`);
  }

  const hasClientRepliedInThisRun = context.vars.lastEvent !== undefined;
  const previousDepth = hasClientRepliedInThisRun ? 0 : Number((context.trigger as { __handoffDepth?: unknown } | undefined)?.__handoffDepth ?? 0);
  if (previousDepth >= MAX_HANDOFF_DEPTH) {
    return failedHandoff(
      "max_handoff_depth_reached",
      `Mais de ${MAX_HANDOFF_DEPTH} conexões de fluxo seguidas sem o cliente responder: parado para não girar em círculo.`,
    );
  }

  const { handOffAttendanceFlow } = await import("@/features/attendance-flows/server/handoff");
  const trigger = (context.trigger ?? {}) as { trackingId?: unknown };
  const handoff = await handOffAttendanceFlow({
    leadId,
    fromWorkflowId: sourceWorkflowId,
    toWorkflowId: subWorkflow.id,
    initialData: {
      __handoffDepth: previousDepth + 1,
      handedOffFromWorkflow: sourceWorkflowId,
      ...(typeof trigger.trackingId === "string" ? { trackingId: trigger.trackingId } : {}),
    },
    flowVariables: context.vars,
  });
  if (handoff.status === "lock_not_held") {
    // Equipe assumiu enquanto o fluxo rodava: o lead já não é do fluxo, então este também para.
    return { output: { handedOff: false, reason: "lock_not_held", endFlow: true }, chosenOutput: "main" };
  }
  if (handoff.status === "dispatch_failed") {
    // A trava já saiu desta execução: ela para aqui (um FAILED deixaria o motor seguir os caminhos paralelos sem a trava).
    return { output: { handedOff: false, reason: "dispatch_failed", error: "Falha ao iniciar o fluxo conectado.", endFlow: true }, chosenOutput: "main" };
  }
  // `endFlow` encerra esta execução, inclusive caminhos paralelos: o lead agora é do fluxo de destino.
  return { output: { handedOff: true, subWorkflowId: subWorkflow.id, subRunId: handoff.runId, endFlow: true }, chosenOutput: "main" };
}
