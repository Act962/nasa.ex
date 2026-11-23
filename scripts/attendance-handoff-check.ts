// Confere a "Conexão de fluxo" entre fluxos do FlowAstro (spec 0139, CB-8) no banco de desenvolvimento. Rodar:
//   pnpm tsx --conditions=react-server scripts/attendance-handoff-check.ts
// Cria dois fluxos de teste numa empresa que já tem lead, roda os casos e apaga os fluxos no fim.
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { claimAttendanceRun, findAttendanceLock } from "../src/features/attendance-flows/server/lock";
import { handOffAttendanceFlow } from "../src/features/attendance-flows/server/handoff";
import { callWorkflowExecutor } from "../src/features/workflows/lib/agent-executors/control";
import { runWorkflow } from "../src/features/workflows/lib/run-workflow";
import { getAgentExecutorRegistry } from "../src/features/workflows/lib/agent-executor-registry";
import { Prisma } from "../src/generated/prisma/client";
import type { WorkflowContext } from "../src/features/workflows/lib/workflow-context";

let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function createAttendanceFlow(organizationId: string, name: string, isActive = true) {
  return prisma.workflow.create({
    data: {
      name,
      organizationId,
      kind: "ATTENDANCE",
      agentMode: true,
      isActive,
      nodes: { create: [{ name: "Entrada", type: "ATTENDANCE_START", position: { x: 0, y: 0 }, data: { mode: "DEFAULT" } }] },
    },
    select: { id: true },
  });
}

function attendanceContext(params: { leadId: string; workflowId: string; trigger?: Record<string, unknown>; vars?: Record<string, unknown> }): WorkflowContext {
  return { lead: { id: params.leadId }, trigger: params.trigger ?? {}, vars: params.vars ?? {}, nodeOutputs: {}, workflowId: params.workflowId, flowKind: "ATTENDANCE" };
}

async function main() {
  const candidateLeads = await prisma.lead.findMany({
    where: { conversation: { messages: { some: { fromMe: false } } } },
    take: 20,
    select: { id: true, tracking: { select: { organizationId: true } } },
  });
  const lockedLeadIds = new Set(
    (await prisma.workflowRun.findMany({ where: { attendanceLeadId: { in: candidateLeads.map((candidate) => candidate.id) } }, select: { attendanceLeadId: true } })).map(
      (run) => run.attendanceLeadId,
    ),
  );
  const lead = candidateLeads.find((candidate) => !lockedLeadIds.has(candidate.id));
  if (!lead) throw new Error("Nenhum lead livre no banco de desenvolvimento");
  const organizationId = lead.tracking.organizationId;
  const createdFlowIds: string[] = [];
  const inboxMessage = await prisma.message.findFirst({
    where: { fromMe: false, conversation: { leadId: lead.id } },
    select: { id: true, metadata: true },
  });
  if (!inboxMessage) throw new Error("Lead sem mensagem de entrada");

  try {
    const sourceFlow = await createAttendanceFlow(organizationId, "[teste CB-8] menu");
    const targetFlow = await createAttendanceFlow(organizationId, "[teste CB-8] promoção");
    const inactiveFlow = await createAttendanceFlow(organizationId, "[teste CB-8] desligado", false);
    createdFlowIds.push(sourceFlow.id, targetFlow.id, inactiveFlow.id);

    const sourceRunId = await claimAttendanceRun({ workflowId: sourceFlow.id, leadId: lead.id, entryMode: "DEFAULT" });
    check("preparo: lead entra no fluxo de origem", Boolean(sourceRunId));

    // Mensagem que o cliente mandou enquanto o fluxo de origem rodava: está na caixa da execução de origem.
    await prisma.message.update({
      where: { id: inboxMessage.id },
      data: { metadata: { ...((inboxMessage.metadata as Record<string, unknown> | null) ?? {}), attendanceRunId: sourceRunId } as Prisma.InputJsonValue },
    });
    const dispatched: Record<string, unknown>[] = [];
    const handoff = await handOffAttendanceFlow(
      {
        leadId: lead.id,
        fromWorkflowId: sourceFlow.id,
        toWorkflowId: targetFlow.id,
        initialData: { __handoffDepth: 1 },
        flowVariables: { nome: "Ana", idade: 31, __callDepth: 2, lastEvent: { messageText: "oi" }, lastIncomingMessage: "oi" },
      },
      async (payload) => {
        dispatched.push(payload);
      },
    );
    const lockAfter = await findAttendanceLock(lead.id);
    const sourceRunAfter = await prisma.workflowRun.findUnique({ where: { id: sourceRunId! }, select: { attendanceLeadId: true } });
    check("CB-8 trava passa para a execução nova do fluxo conectado", handoff.status === "handed_off" && lockAfter?.workflowId === targetFlow.id, handoff.status);
    check("CB-8 execução de origem fica sem a trava", sourceRunAfter?.attendanceLeadId === null);
    check(
      "CB-8 destino começa pela Entrada com a trava (ATTENDANCE_START + attendanceRunId)",
      dispatched.length === 1 && dispatched[0].triggerType === "ATTENDANCE_START" && dispatched[0].attendanceRunId === lockAfter?.id,
      JSON.stringify(dispatched[0] ?? {}),
    );
    check(
      "CB-8 variáveis coletadas na origem chegam ao destino, sem as internas do motor",
      JSON.stringify(dispatched[0]?.initialVars) === JSON.stringify({ nome: "Ana", idade: 31 }),
      JSON.stringify(dispatched[0]?.initialVars),
    );
    const movedMessage = await prisma.message.findUnique({ where: { id: inboxMessage.id }, select: { metadata: true } });
    check(
      "CB-8 mensagem pendente na caixa da origem passa para a execução nova",
      (movedMessage?.metadata as { attendanceRunId?: unknown } | null)?.attendanceRunId === lockAfter?.id,
    );

    const staleHandoff = await handOffAttendanceFlow({ leadId: lead.id, fromWorkflowId: sourceFlow.id, toWorkflowId: targetFlow.id, initialData: {} }, async () => {
      throw new Error("não deveria disparar");
    });
    check("CB-8 origem que já não tem o lead não passa trava nenhuma", staleHandoff.status === "lock_not_held" && (await findAttendanceLock(lead.id))?.id === lockAfter?.id);

    const failedHandoff = await handOffAttendanceFlow({ leadId: lead.id, fromWorkflowId: targetFlow.id, toWorkflowId: sourceFlow.id, initialData: {} }, async () => {
      throw new Error("Inngest fora do ar");
    });
    check("CB-8 disparo que falha solta a trava (o lead não fica preso)", failedHandoff.status === "dispatch_failed" && (await findAttendanceLock(lead.id)) === null);

    const inactiveResult = await callWorkflowExecutor({
      nodeId: "teste",
      nodeType: "CALL_WORKFLOW",
      data: { workflowId: inactiveFlow.id },
      context: attendanceContext({ leadId: lead.id, workflowId: sourceFlow.id }),
      dryRun: false,
    });
    check("CB-8 fluxo conectado desligado falha com motivo claro", inactiveResult.status === "FAILED" && /desligado/.test(inactiveResult.errorMessage ?? ""), inactiveResult.errorMessage);

    const fromAutomationResult = await callWorkflowExecutor({
      nodeId: "teste",
      nodeType: "CALL_WORKFLOW",
      data: { workflowId: targetFlow.id },
      context: { lead: { id: lead.id }, trigger: {}, vars: {}, nodeOutputs: {}, workflowId: "automacao-comum" },
      dryRun: false,
    });
    check(
      "CB-8 automação comum chamando fluxo do FlowAstro falha dizendo o motivo",
      fromAutomationResult.status === "FAILED" && (fromAutomationResult.output as { reason?: string }).reason === "attendance_flow_from_automation",
      fromAutomationResult.errorMessage,
    );

    const loopResult = await callWorkflowExecutor({
      nodeId: "teste",
      nodeType: "CALL_WORKFLOW",
      data: { workflowId: targetFlow.id },
      context: attendanceContext({ leadId: lead.id, workflowId: sourceFlow.id, trigger: { __handoffDepth: 5 } }),
      dryRun: false,
    });
    check(
      "CB-8 ciclo A→B→A sem o cliente responder é limitado",
      loopResult.status === "FAILED" && (loopResult.output as { reason?: string }).reason === "max_handoff_depth_reached",
      loopResult.errorMessage,
    );

    const backToMenuResult = await callWorkflowExecutor({
      nodeId: "teste",
      nodeType: "CALL_WORKFLOW",
      data: { workflowId: targetFlow.id },
      context: attendanceContext({ leadId: lead.id, workflowId: sourceFlow.id, trigger: { __handoffDepth: 5 }, vars: { lastEvent: { messageText: "voltar" } } }),
      dryRun: false,
    });
    check(
      "CB-8 voltar ao menu depois de o cliente responder não conta como ciclo",
      backToMenuResult.status !== "FAILED" && (backToMenuResult.output as { reason?: string }).reason === "lock_not_held",
      JSON.stringify(backToMenuResult.output),
    );

    // Motor: Início → Conexão de fluxo, e em paralelo Início → Condição → Atraso. A conexão encerra a execução de origem,
    // então o Atraso nunca roda (senão a execução ficaria suspensa, falando com o cliente sem a trava).
    const engineFlow = await prisma.workflow.create({
      data: { name: "[teste CB-8] motor", organizationId, kind: "ATTENDANCE", agentMode: true, isActive: true },
      select: { id: true },
    });
    createdFlowIds.push(engineFlow.id);
    const nodeOf = (name: string, type: "ATTENDANCE_START" | "CALL_WORKFLOW" | "IF_CONDITION" | "WAIT", data: Prisma.InputJsonValue) =>
      prisma.node.create({ data: { workflowId: engineFlow.id, name, type, position: { x: 0, y: 0 }, data }, select: { id: true } });
    const startNode = await nodeOf("Início", "ATTENDANCE_START", { mode: "DEFAULT" });
    const connectNode = await nodeOf("Conexão", "CALL_WORKFLOW", { workflowId: targetFlow.id });
    const conditionNode = await nodeOf("Condição", "IF_CONDITION", { match: "ALL", rules: [] });
    const delayNode = await nodeOf("Atraso", "WAIT", { action: { type: "minutes", minutes: 5 } });
    await prisma.connection.createMany({
      data: [
        { workflowId: engineFlow.id, fromNodeId: startNode.id, toNodeId: connectNode.id, fromOutput: "main", toInput: "main" },
        { workflowId: engineFlow.id, fromNodeId: startNode.id, toNodeId: conditionNode.id, fromOutput: "main", toInput: "main" },
        { workflowId: engineFlow.id, fromNodeId: conditionNode.id, toNodeId: delayNode.id, fromOutput: "true", toInput: "main" },
        { workflowId: engineFlow.id, fromNodeId: conditionNode.id, toNodeId: delayNode.id, fromOutput: "false", toInput: "main" },
      ],
    });
    const engineRunId = await claimAttendanceRun({ workflowId: engineFlow.id, leadId: lead.id, entryMode: "DEFAULT" });
    const engineResult = await runWorkflow(
      { workflowId: engineFlow.id, triggerType: "ATTENDANCE_START", leadId: lead.id, attendanceRunId: engineRunId!, triggerPayload: {} },
      getAgentExecutorRegistry(),
    );
    const engineRun = await prisma.workflowRun.findUnique({ where: { id: engineRunId! }, select: { status: true, attendanceLeadId: true } });
    const delayRuns = await prisma.workflowNodeRun.count({ where: { runId: engineRunId!, nodeId: delayNode.id } });
    const connectRun = await prisma.workflowNodeRun.findFirst({ where: { runId: engineRunId!, nodeId: connectNode.id }, select: { output: true } });
    check(
      "CB-8 motor: a conexão encerra a execução de origem, que fica sem a trava",
      engineResult.status === "SUCCESS" && engineRun?.status === "SUCCESS" && engineRun.attendanceLeadId === null,
      `${engineResult.status} · ${JSON.stringify(connectRun?.output)}`,
    );
    check("CB-8 motor: caminho paralelo da origem não continua depois da conexão", delayRuns === 0, String(delayRuns));
  } finally {
    await prisma.workflow.deleteMany({ where: { id: { in: createdFlowIds } } });
    await prisma.message.update({ where: { id: inboxMessage.id }, data: { metadata: inboxMessage.metadata === null ? Prisma.DbNull : (inboxMessage.metadata as Prisma.InputJsonValue) } });
  }

  console.log(failures === 0 ? "\nTUDO CERTO" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
