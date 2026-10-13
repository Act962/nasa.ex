// Confere a saída por opção do menu salvo (spec 0098) num funil temporário do banco de desenvolvimento, apagado no fim.
// Nada é enviado: o motor roda a seco. Rodar:
//   NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE=true pnpm tsx --conditions=react-server scripts/verify-menu-option-outputs.ts <organizationId> <userId>
import "./astro-qa/load-env";
import { createId } from "@paralleldrive/cuid2";
import prisma from "../src/lib/prisma";
import { applyAttendanceTemplate } from "../src/features/tracking-chat-ai/lib/attendance-setup/apply-attendance-template";
import { TOPIC_MENU_NAME_PREFIX } from "../src/features/tracking-chat-ai/lib/topic-menu";
import { getAgentExecutorRegistry } from "../src/features/workflows/lib/agent-executor-registry";
import { buttonOutputId } from "../src/features/workflows/lib/button-reply-flow";
import { collectFlowProblems } from "../src/features/workflows/lib/flow-problems";
import { MENU_OPTION_TRIGGER, findMenuOptionBranches, menuOptionOutputs, savedMenuIdOf } from "../src/features/workflows/lib/menu-option-outputs";
import { runWorkflow } from "../src/features/workflows/lib/run-workflow";

const [organizationId, userId] = process.argv.slice(2);
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function main() {
  const tagsBefore = new Set((await prisma.tag.findMany({ where: { organizationId }, select: { id: true } })).map((tag) => tag.id));
  const tracking = await prisma.tracking.create({ data: { name: "verificacao-saida-por-opcao-0098", organizationId }, select: { id: true } });
  try {
    await prisma.$transaction((tx) => applyAttendanceTemplate(tx, { organizationId, trackingId: tracking.id, userId, companyName: "Empresa Teste" }));
    const loadFlows = () =>
      prisma.workflow.findMany({
        where: { trackingId: tracking.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, nodes: { select: { id: true, type: true, data: true } }, connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } } },
      });
    const menus = await prisma.aiButtonPreset.findMany({ where: { trackingId: tracking.id, name: { startsWith: TOPIC_MENU_NAME_PREFIX } } });
    const flow = (await loadFlows())[0];
    const menuNode = flow.nodes.find((node) => node.type === "SEND_MESSAGE")!;
    const menu = menus.find((candidate) => candidate.id === savedMenuIdOf(menuNode.data))!;
    const optionIds = (menu.buttons as { id: string }[]).map((button) => button.id);

    const outputs = menuOptionOutputs(menuNode.data, menus);
    const answeredOptions = (menu.buttons as { answer?: string }[]).filter((button) => typeof button.answer === "string").length;
    check("CA-1 uma saída por pergunta do menu, sem as linhas de ação", outputs?.length === answeredOptions && answeredOptions === optionIds.length - 1, `${outputs?.length} saídas, ${optionIds.length} opções`);
    process.env.NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE = "false";
    check("CA-8 recurso desligado: nenhuma saída por opção", menuOptionOutputs(menuNode.data, menus) === null);
    process.env.NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE = "true";

    check("CA-3 opção sem nada ligado não roda passo", findMenuOptionBranches({ flows: await loadFlows(), menuId: menu.id, optionId: optionIds[1] }).length === 0);

    const tagNodeId = createId();
    const anyTag = await prisma.tag.findFirst({ where: { organizationId }, select: { id: true } });
    await prisma.node.create({ data: { id: tagNodeId, workflowId: flow.id, name: "Tag", type: "TAG", position: { x: 720, y: 0 }, data: { action: { type: "ADD", tagIds: anyTag ? [anyTag.id] : [] } } } });
    await prisma.connection.create({ data: { id: createId(), workflowId: flow.id, fromNodeId: menuNode.id, toNodeId: tagNodeId, fromOutput: buttonOutputId(optionIds[1]), toInput: "main" } });

    const flowsWithBranch = await loadFlows();
    const branches = findMenuOptionBranches({ flows: flowsWithBranch, menuId: menu.id, optionId: optionIds[1] });
    check("CA-2 opção ligada acha o passo do fluxo", branches.length === 1 && branches[0].nodeId === menuNode.id && branches[0].workflowId === flow.id);
    check("outra opção do mesmo menu continua sem passo", findMenuOptionBranches({ flows: flowsWithBranch, menuId: menu.id, optionId: optionIds[0] }).length === 0);
    check("CA-6 opção de outro menu não acha nada", findMenuOptionBranches({ flows: flowsWithBranch, menuId: "outro-menu", optionId: optionIds[1] }).length === 0);

    const registry = getAgentExecutorRegistry();
    const fromOption = await runWorkflow({ workflowId: flow.id, triggerType: MENU_OPTION_TRIGGER, leadId: null, dryRun: true, startFrom: { nodeId: branches[0].nodeId, output: branches[0].output } }, registry);
    const ranTypes = ((fromOption as { log?: { type: string }[] }).log ?? []).map((entry) => entry.type);
    check("CA-2 o motor começa pela saída da opção e roda só o passo ligado", ranTypes.length === 1 && ranTypes[0] === "TAG", ranTypes.join(", ") || "nada rodou");
    const fromUnlinked = await runWorkflow({ workflowId: flow.id, triggerType: MENU_OPTION_TRIGGER, leadId: null, dryRun: true, startFrom: { nodeId: menuNode.id, output: buttonOutputId(optionIds[0]) } }, registry);
    check("saída sem ligação não roda nada e não dá erro", ((fromUnlinked as { log?: unknown[] }).log ?? []).length === 0, String((fromUnlinked as { status?: string }).status));
    const fromTrigger = await runWorkflow({ workflowId: flow.id, triggerType: "LEAD_TAGGED", leadId: null, dryRun: true }, registry);
    const triggerTypes = ((fromTrigger as { log?: { type: string }[] }).log ?? []).map((entry) => entry.type);
    check("CA-9 pelo gatilho de sempre, o passo da opção não roda", !triggerTypes.includes("TAG"), triggerTypes.join(", "));

    const flowWithBranch = flowsWithBranch.find((candidate) => candidate.id === flow.id)!;
    const edges = flowWithBranch.connections.map((connection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId, sourceHandle: connection.fromOutput }));
    const filledMenus = menus.map((candidate) => ({ ...candidate, bodyText: "Texto real", buttons: (candidate.buttons as { id: string; text: string }[]).map((button) => ({ id: button.id, text: button.text, answer: "Resposta real" })) }));
    const healthy = collectFlowProblems(flowWithBranch.nodes, edges, "meta", filledMenus);
    check("ligação numa opção que existe não gera aviso", !healthy.all.some((problem) => problem.code === "MENU_OPTION_MISSING"));
    const shrunkMenus = filledMenus.map((candidate) => (candidate.id === menu.id ? { ...candidate, buttons: candidate.buttons.filter((button) => button.id !== optionIds[1]) } : candidate));
    const orphan = collectFlowProblems(flowWithBranch.nodes, edges, "meta", shrunkMenus);
    check("CA-7 opção removida do menu deixa a ligação em vermelho", orphan.all.some((problem) => problem.code === "MENU_OPTION_MISSING" && problem.severity === "error"));
  } finally {
    await prisma.tracking.delete({ where: { id: tracking.id } });
    const createdTags = (await prisma.tag.findMany({ where: { organizationId }, select: { id: true } })).filter((tag) => !tagsBefore.has(tag.id)).map((tag) => tag.id);
    if (createdTags.length > 0) await prisma.tag.deleteMany({ where: { id: { in: createdTags } } });
  }
  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
