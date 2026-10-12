// Confere o modelo de atendimento (spec 0097) no banco de desenvolvimento, num funil temporário que é apagado no fim.
// Rodar: pnpm tsx --conditions=react-server scripts/verify-attendance-template.ts <organizationId> <userId> <trackingComMenuProprio>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { applyAttendanceTemplate } from "../src/features/tracking-chat-ai/lib/attendance-setup/apply-attendance-template";
import { MENU_PRESET_NAME } from "../src/features/tracking-chat-ai/lib/attendance-setup/script-draft";
import { TOPIC_MENU_NAME_PREFIX, findTopicAnswer } from "../src/features/tracking-chat-ai/lib/topic-menu";
import { collectFlowProblems } from "../src/features/workflows/lib/flow-problems";
import { hasPlaceholderText } from "../src/features/workflows/lib/placeholder-text";
import { buildAttendanceMap } from "../src/features/workflows/lib/operation-map-attendance";

const [organizationId, userId, trackingWithOwnMenu] = process.argv.slice(2);
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function main() {
  const tagsBefore = new Set((await prisma.tag.findMany({ where: { organizationId }, select: { id: true } })).map((tag) => tag.id));
  const tracking = await prisma.tracking.create({ data: { name: "verificacao-modelo-0097", organizationId }, select: { id: true } });
  const apply = () => prisma.$transaction((tx) => applyAttendanceTemplate(tx, { organizationId, trackingId: tracking.id, userId, companyName: "Empresa Teste" }));
  try {
    const first = await apply();
    check("CA-1 primeira criação grava o modelo", first.status === "created" && first.createdFlowNames.length === 3 && first.createdMenuNames.length === 4, JSON.stringify(first));

    const flows = await prisma.workflow.findMany({
      where: { trackingId: tracking.id },
      select: { id: true, name: true, isActive: true, agentMode: true, folderId: true, nodes: { select: { id: true, type: true, data: true, position: true } }, connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } } },
    });
    const menus = await prisma.aiButtonPreset.findMany({ where: { trackingId: tracking.id } });
    check("CA-1 três fluxos, todos desligados", flows.length === 3 && flows.every((flow) => !flow.isActive));
    check("CA-1 quatro menus, todos desligados", menus.length === 4 && menus.every((menu) => !menu.isActive));
    const initialMenu = menus.find((menu) => menu.name === MENU_PRESET_NAME);
    const topicMenus = menus.filter((menu) => menu.name.startsWith(TOPIC_MENU_NAME_PREFIX));
    check("menu inicial sem texto de exemplo", Boolean(initialMenu) && !hasPlaceholderText([initialMenu?.bodyText, initialMenu?.buttons]), initialMenu?.bodyText);
    check("menus de perguntas com texto de exemplo (travados)", topicMenus.length === 3 && topicMenus.every((menu) => hasPlaceholderText([menu.bodyText, menu.buttons])));
    check("tags do menu resolvidas, sem marcador solto", !JSON.stringify(flows).includes("TAG_NOT_RESOLVED") && !JSON.stringify(flows).includes("{{TAG"));

    for (const flow of flows) {
      const problems = collectFlowProblems(
        flow.nodes,
        flow.connections.map((connection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId, sourceHandle: connection.fromOutput })),
        "meta",
        menus,
      );
      check(`CA-4 "${flow.name}" fica em vermelho por texto de exemplo`, problems.all.some((problem) => problem.code === "PLACEHOLDER_TEXT" && problem.severity === "error"));
    }

    const filledMenus = menus.map((menu) => ({ ...menu, bodyText: "Texto real", buttons: (menu.buttons as { answer?: string }[]).map((button) => ({ ...button, answer: button.answer ? "Resposta real" : undefined })) }));
    const firstFlow = flows[0];
    const afterFilling = collectFlowProblems(
      firstFlow.nodes,
      firstFlow.connections.map((connection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId, sourceHandle: connection.fromOutput })),
      "meta",
      filledMenus,
    );
    check("CA-6 com os textos trocados, o aviso some", !afterFilling.all.some((problem) => problem.code === "PLACEHOLDER_TEXT"));

    const firstQuestionId = (topicMenus[0].buttons as { id: string }[])[0].id;
    check("pergunta do modelo é achada pelo clique", Boolean(findTopicAnswer(topicMenus, firstQuestionId)));

    const attendance = buildAttendanceMap({ menus: menus as never, workflows: flows as never, scriptMenuName: MENU_PRESET_NAME, hasBookingMenu: false });
    check("CA-2 o mapa liga o menu aos três fluxos", attendance.menuLinks.length === 3, `${attendance.menuLinks.length} ligações`);

    const second = await apply();
    const [flowCount, menuCount] = await Promise.all([prisma.workflow.count({ where: { trackingId: tracking.id } }), prisma.aiButtonPreset.count({ where: { trackingId: tracking.id } })]);
    check("CA-3 criar de novo não duplica", second.status === "already_complete" && flowCount === 3 && menuCount === 4, second.status);

    await prisma.workflow.delete({ where: { id: flows[0].id } });
    const third = await apply();
    check("CB-2 fluxo apagado é recriado, só ele", third.status === "created" && third.createdFlowNames.length === 1 && third.createdMenuNames.length === 0, JSON.stringify(third));

    if (trackingWithOwnMenu) {
      const countsBefore = await prisma.workflow.count({ where: { trackingId: trackingWithOwnMenu } });
      const refused = await prisma.$transaction((tx) => applyAttendanceTemplate(tx, { organizationId, trackingId: trackingWithOwnMenu, userId, companyName: "Empresa Teste" }));
      const countsAfter = await prisma.workflow.count({ where: { trackingId: trackingWithOwnMenu } });
      check("CA-8 funil com menu próprio é recusado e nada é gravado", refused.status === "has_own_menu" && countsBefore === countsAfter, refused.status);
    }
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
