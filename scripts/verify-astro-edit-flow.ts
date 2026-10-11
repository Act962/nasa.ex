// Confere a ação "editar fluxo com ASTRO" (spec 0094) no banco de desenvolvimento, SEM chamar IA: o
// plano que o modelo proporia é posto direto na memória da ação. Cria um fluxo de teste desligado,
// edita, confere e apaga no fim. Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-astro-edit-flow.ts <organizationId> <userId> <trackingId>
import "./astro-qa/load-env";
process.env.NEXT_PUBLIC_ASTRO_FLOW_EDIT = "true";

const [organizationId, userId, trackingId] = process.argv.slice(2);
const TEST_FLOW_NAME = "ZZ teste do Astro editar fluxo (apagar)";
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { editFlowAction } = await import("../src/features/astro/actions/tracking/edit-flow");
  const { cacheFlowEditPlan, flowEditPlanKey, readCachedFlowEditPlan } = await import("../src/features/astro/actions/tracking/flow-edit-cache");
  const { createWorkflowFromBlueprint } = await import("../src/features/workflows/lib/agent-presets/create-from-blueprint");
  const { DECIDE_LATER_ANSWER } = await import("../src/features/workflows/lib/flow-edit-plan");
  const { buildPickedAnswer } = await import("../src/features/astro/lib/astro-picker");

  await prisma.workflow.deleteMany({ where: { trackingId, name: TEST_FLOW_NAME } });
  const created = await prisma.$transaction((tx) =>
    createWorkflowFromBlueprint(tx, {
      trackingId,
      userId,
      agentMode: true,
      isActive: false,
      blueprint: {
        name: TEST_FLOW_NAME,
        nodes: [
          { id: "t", type: "NEW_LEAD", position: { x: 0, y: 0 }, data: {} },
          { id: "m", type: "SEND_MESSAGE", position: { x: 320, y: 0 }, data: { action: { payload: { type: "TEXT", message: "Olá {{lead.name}}!" } } } },
          { id: "w", type: "WAIT", position: { x: 640, y: 0 }, data: { action: { type: "hours", hours: 2 } } },
        ],
        edges: [{ fromNodeId: "t", toNodeId: "m" }, { fromNodeId: "m", toNodeId: "w" }],
      },
    }),
  );
  const workflowId = created.workflowId;
  const ctx = { userId, organizationId, route: { pathname: `/tracking/${trackingId}/workflows/${workflowId}` }, channel: "CHAT" } as never;

  try {
    const loadFlow = () => prisma.workflow.findUniqueOrThrow({ where: { id: workflowId }, select: { updatedAt: true, isActive: true, nodes: { select: { id: true, type: true, data: true } }, connections: { select: { fromNodeId: true, toNodeId: true } } } });
    const nodeIdOf = (flow: Awaited<ReturnType<typeof loadFlow>>, type: string) => flow.nodes.find((node) => node.type === type)!.id;
    /** Põe na memória da ação o plano que o modelo proporia, para a conferência não custar chamada de IA. */
    const seedPlan = async (request: string) => {
      const flow = await loadFlow();
      const key = flowEditPlanKey({ organizationId, userId, workflowId, workflowUpdatedAt: flow.updatedAt, request });
      cacheFlowEditPlan(key, {
        operations: [{ kind: "insert_step", newStepId: "n1", afterStepId: nodeIdOf(flow, "SEND_MESSAGE"), stepType: "SEND_AGENDA", data: { action: { agendaId: "needsReview", messageTemplate: "Marque seu horário:" }, needsReview: true } }],
        questions: [{ kind: "agenda", operationIndex: 0 }],
      });
      if (!readCachedFlowEditPlan(key)) throw new Error("O plano não ficou na memória: parando para não chamar a IA.");
    };

    const firstRequest = "Insira o envio da agenda depois da mensagem de boas-vindas.";
    await seedPlan(firstRequest);
    const input: Record<string, string | undefined> = { editRequest: firstRequest };

    const asked = await editFlowAction.execute({ ctx, input: input as never, dryRun: true });
    const agendaOptions = asked.status === "needs_input" && asked.picker?.kind === "select" ? asked.picker.options : [];
    check("CA-1 pergunta qual agenda, com opções para tocar", asked.status === "needs_input" && asked.title === "Qual agenda?" && agendaOptions.length >= 2, `${agendaOptions.length} opções`);
    const realAgendas = await prisma.agenda.findMany({ where: { organizationId, trackingId, isActive: true }, select: { id: true, name: true } });
    const offeredLabels = agendaOptions.map((option) => option.label);
    check("CA-1 só as agendas ativas deste funil (mais \"Decidir depois\")", realAgendas.every((agenda) => offeredLabels.includes(agenda.name)) && offeredLabels.length === realAgendas.length + 1);

    const foreign = await editFlowAction.execute({ ctx, input: { ...input, answer1: buildPickedAnswer("Agenda de outra empresa", "cmzzzzzzzzzzzzzzzzzzzzzzz") } as never, dryRun: true });
    check("CA-7 agenda que não é do funil é recusada: pergunta de novo", foreign.status === "needs_input" && foreign.title === "Qual agenda?");

    input.answer1 = buildPickedAnswer(realAgendas[0].name, realAgendas[0].id);
    const preview = await editFlowAction.execute({ ctx, input: input as never, dryRun: true });
    console.log(`\n[${preview.status}] ${preview.title}\n${preview.description}\n`);
    check("CA-2 a prévia diz o que vai inserir e onde", preview.status === "done" && /Inserir .*depois de/.test(preview.description));
    check("CA-4 o plano mostrado fica guardado para o sim", typeof input.planJson === "string" && typeof input.expectedUpdatedAt === "string");
    check("a prévia não grava nada", (await loadFlow()).nodes.length === 3);

    // CA-4: trocar o texto do pedido depois da prévia não muda o que é aplicado.
    const applied = await editFlowAction.execute({ ctx, input: { ...input, editRequest: "Apague todos os passos deste fluxo." } as never });
    const afterApply = await loadFlow();
    const agendaNode = afterApply.nodes.find((node) => node.type === "SEND_AGENDA");
    const agendaData = (agendaNode?.data ?? {}) as { action?: { agendaId?: string }; needsReview?: boolean };
    check("CA-2 o passo entrou no fluxo com a agenda escolhida, sem vermelho", applied.status === "done" && afterApply.nodes.length === 4 && agendaData.action?.agendaId === realAgendas[0].id && agendaData.needsReview === undefined);
    const hasLink = (fromType: string, toType: string) => afterApply.connections.some((connection) => connection.fromNodeId === nodeIdOf(afterApply, fromType) && connection.toNodeId === nodeIdOf(afterApply, toType));
    check("CA-2 ligado no lugar certo: mensagem → agenda → espera", hasLink("SEND_MESSAGE", "SEND_AGENDA") && hasLink("SEND_AGENDA", "WAIT") && !hasLink("SEND_MESSAGE", "WAIT") && hasLink("NEW_LEAD", "SEND_MESSAGE"));
    check("CA-4 o que foi aplicado é o plano mostrado, não o texto trocado", afterApply.nodes.some((node) => node.type === "WAIT") && afterApply.nodes.some((node) => node.type === "NEW_LEAD"));
    check("o Astro não ligou o fluxo", afterApply.isActive === false);
    check("o resultado leva ao editor com a marca de recarregar", applied.status === "done" && /\/workflows\/.+\?astroEdit=\d+/.test(applied.internalUrl ?? ""));

    const stale = await editFlowAction.execute({ ctx, input: input as never });
    check("CB-1 fluxo alterado depois da proposta: recusa aplicar", stale.status === "error" && stale.title === "O fluxo mudou", stale.title);

    // RF-8: fluxo ligado não fica com passo incompleto.
    await prisma.workflow.update({ where: { id: workflowId }, data: { isActive: true } });
    const secondRequest = "Insira mais um envio de agenda depois da mensagem.";
    await seedPlan(secondRequest);
    const activeInput: Record<string, string | undefined> = { editRequest: secondRequest, answer1: DECIDE_LATER_ANSWER };
    const blocked = await editFlowAction.execute({ ctx, input: activeInput as never, dryRun: true });
    check("CA-5 fluxo ligado e passo incompleto: pergunta antes de gravar", blocked.status === "needs_input" && blocked.title === "Este fluxo está ligado", blocked.title);
    const cancelled = await editFlowAction.execute({ ctx, input: { ...activeInput, activeFlowChoice: "cancel" } as never, dryRun: true });
    check("CA-5 \"Não alterar\" não grava nada e o fluxo segue ligado", cancelled.status === "error" && (await loadFlow()).nodes.length === 4 && (await loadFlow()).isActive === true);
    activeInput.activeFlowChoice = "turn_off";
    const turnOffPreview = await editFlowAction.execute({ ctx, input: activeInput as never, dryRun: true });
    check("CA-5 a prévia avisa que o fluxo será desligado", turnOffPreview.status === "done" && turnOffPreview.description.includes("será desligado"));
    const turnedOff = await editFlowAction.execute({ ctx, input: activeInput as never });
    const afterTurnOff = await loadFlow();
    const reviewNodes = afterTurnOff.nodes.filter((node) => (node.data as { needsReview?: boolean }).needsReview === true);
    check("CA-3 e CA-5 \"Decidir depois\" cria o passo em vermelho e o fluxo é desligado junto", turnedOff.status === "done" && afterTurnOff.nodes.length === 5 && reviewNodes.length === 1 && afterTurnOff.isActive === false);

    const outsider = await editFlowAction.execute({ ctx: { userId, organizationId: "org-que-nao-existe", route: { pathname: `/x/workflows/${workflowId}` }, channel: "CHAT" } as never, input: { editRequest: firstRequest } as never, dryRun: true });
    check("CA-7 outra empresa não alcança o fluxo", outsider.status === "error", outsider.title);
    const stranger = await editFlowAction.execute({ ctx: { userId: "usuario-que-nao-existe", organizationId, route: { pathname: `/x/workflows/${workflowId}` }, channel: "CHAT" } as never, input: { editRequest: firstRequest } as never, dryRun: true });
    check("CA-6 quem não tem acesso ao fluxo é recusado antes de qualquer IA", stranger.status === "error", stranger.title);
    const viaWhatsApp = await editFlowAction.execute({ ctx: { userId, organizationId, route: {}, channel: "WHATSAPP" } as never, input: { editRequest: firstRequest } as never, dryRun: true });
    check("pelo WhatsApp manda para a plataforma", viaWhatsApp.status === "error" && viaWhatsApp.title === "Continue na plataforma");
    const noFlowOpen = await editFlowAction.execute({ ctx: { userId, organizationId, route: { trackingId }, channel: "CHAT" } as never, input: { editRequest: firstRequest } as never, dryRun: true });
    check("CA-10 sem fluxo aberto, pergunta qual fluxo", noFlowOpen.status === "needs_input" && noFlowOpen.title === "Qual fluxo?");
    const inferred = editFlowAction.inferFields?.(buildPickedAnswer("Edite este fluxo: insira o envio da agenda depois das boas-vindas", workflowId)) as { workflowRef?: string; editRequest?: string };
    check("o campo do editor entrega o fluxo aberto e o pedido, sem pergunta extra", Boolean(inferred.workflowRef?.includes(workflowId)) && inferred.editRequest === "insira o envio da agenda depois das boas-vindas", inferred.editRequest);
  } finally {
    await prisma.workflow.deleteMany({ where: { id: workflowId } });
    console.log("fluxo de teste apagado");
  }
  console.log(failures === 0 ? "\nTUDO CERTO" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
