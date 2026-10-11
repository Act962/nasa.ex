// Confere o mapa da operação e os trechos por etapa (spec 0092). Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-operation-map.ts
import "./astro-qa/load-env";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { splitFlowIntoStageSections } from "../src/features/workflows/lib/flow-stage-sections";
import { CENTER_STACK, LEFT_COLUMN_RIGHT_EDGE, buildAttendanceMap, centerStackHeight, placeAttendance } from "../src/features/workflows/lib/operation-map-attendance";
import { buildOperationMap, layoutOperationMap, type MapWorkflowInput } from "../src/features/workflows/lib/operation-map-graph";

let checks = 0;
function check(label: string, isOk: boolean, detail = "") {
  assert.ok(isOk, `${label}${detail ? ` · ${detail}` : ""}`);
  checks += 1;
  console.log(`ok    ${label}`);
}
const step = (id: string, type: string, data: unknown = {}) => ({ id, type, data });
const chain = (...ids: string[]) => ids.slice(1).map((target, index) => ({ source: ids[index], target }));
const sizeOfStep = () => ({ width: 70, height: 70 });

async function main() {
  const tagTrigger = step("t", "LEAD_TAGGED");
  const noMove = splitFlowIntoStageSections([tagTrigger, step("a", "SEND_MESSAGE"), step("b", "WAIT")], chain("t", "a", "b"));
  check("CA-5 fluxo sem Mover Lead tem um trecho só, em qualquer etapa", noMove.length === 1 && noMove[0].statusId === null && noMove[0].nodeIds.length === 3);

  const moved = splitFlowIntoStageSections(
    [tagTrigger, step("m", "MOVE_LEAD", { trackingId: "tr2", statusId: "s9" }), step("a", "SEND_MESSAGE")],
    chain("t", "m", "a"),
  );
  check("CA-5 Mover Lead configurado abre o segundo trecho com o destino", moved.length === 2 && moved[1].statusId === "s9" && moved[1].trackingId === "tr2" && moved[1].nodeIds.join() === "a");
  check("CA-5 o próprio Mover Lead fica no trecho anterior", moved[0].nodeIds.includes("m"));

  const unset = splitFlowIntoStageSections([tagTrigger, step("m", "MOVE_LEAD", {}), step("a", "SEND_MESSAGE")], chain("t", "m", "a"));
  check("CA-5 Mover Lead sem coluna não abre trecho", unset.length === 1);

  const twoMoves = splitFlowIntoStageSections(
    [tagTrigger, step("m1", "MOVE_LEAD", { statusId: "s1" }), step("a", "TAG"), step("m2", "MOVE_LEAD", { action: { statusId: "s2" } }), step("b", "TAG")],
    chain("t", "m1", "a", "m2", "b"),
  );
  check("CA-5 dois Mover Lead em sequência dão três trechos", twoMoves.length === 3 && twoMoves.map((section) => section.statusId).join() === ",s1,s2");

  const diamond = splitFlowIntoStageSections(
    [tagTrigger, step("m", "MOVE_LEAD", { statusId: "s1" }), step("x", "WAIT"), step("end", "TAG")],
    [...chain("t", "m", "x", "end"), { source: "t", target: "end" }],
  );
  check("CA-5 passo em dois caminhos cai num trecho só, o do caminho mais curto", diamond.flatMap((section) => section.nodeIds).filter((nodeId) => nodeId === "end").length === 1 && diamond[0].nodeIds.includes("end"));

  const columnTrigger = splitFlowIntoStageSections([step("t", "MOVE_LEAD_STATUS", { action: { statusId: "s7" } }), step("a", "TAG")], chain("t", "a"));
  check("CA-5 gatilho de coluna dá a etiqueta da coluna ao primeiro trecho", columnTrigger[0].statusId === "s7");

  const flow = (id: string, folderId: string | null, nodeCount: number): MapWorkflowInput => ({
    id,
    name: id,
    isActive: false,
    folderId,
    nodes: Array.from({ length: nodeCount }, (_, index) => ({ id: `n${index}`, type: index === 0 ? "LEAD_TAGGED" : "SEND_MESSAGE", position: { x: index * 300, y: (index % 2) * 120 }, data: {} })),
    connections: Array.from({ length: Math.max(0, nodeCount - 1) }, (_, index) => ({ id: `c${index}`, fromNodeId: `n${index}`, toNodeId: `n${index + 1}` })),
  });
  const groups = buildOperationMap({ workflows: [flow("a", null, 3), flow("b", "f1", 5), flow("c", "f1", 0), flow("d", null, 2)], folderOrder: ["f1"], sizeOfStep });
  check("CA-1 um retângulo por fluxo", groups.length === 4);
  check("CA-1 fluxos da mesma pasta ficam juntos e antes dos sem pasta", groups.map((group) => group.workflowId).join() === "b,c,a,d");
  check("CA-1 fluxo sem passos vira retângulo vazio", groups[1].steps.length === 0 && groups[1].width > 0);
  check(
    "CA-2 todo passo fica dentro do seu retângulo",
    groups.every((group) => group.steps.every((mapStep) => mapStep.x >= 0 && mapStep.y >= 0 && mapStep.x + mapStep.width <= group.width && mapStep.y + mapStep.height <= group.height)),
  );
  const stepIds = groups.flatMap((group) => group.steps.map((mapStep) => mapStep.id));
  check("CA-2 ids de passo não colidem entre fluxos", new Set(stepIds).size === stepIds.length);
  const overlaps = groups.some((first, firstIndex) =>
    groups.some(
      (second, secondIndex) =>
        firstIndex < secondIndex && first.x < second.x + second.width && second.x < first.x + first.width && first.y < second.y + second.height && second.y < first.y + first.height,
    ),
  );
  check("CA-3 retângulos não se sobrepõem na disposição automática", !overlaps);
  const moved2 = buildOperationMap({ workflows: [flow("a", null, 3)], folderOrder: [], sizeOfStep, savedPositions: { a: { x: 900, y: 40 } } });
  check("CA-4 posição arrastada pela pessoa vale no lugar da automática", moved2[0].x === 900 && moved2[0].y === 40);

  // Disposição sem sobreposição (ajuste de 2026-10-11): arrastados viram obstáculo e a ordem é estável.
  const anyOverlap = (placedGroups: { x: number; y: number; width: number; height: number }[]) =>
    placedGroups.some((first, firstIndex) =>
      placedGroups.some(
        (second, secondIndex) =>
          secondIndex > firstIndex && first.x < second.x + second.width && second.x < first.x + first.width && first.y < second.y + second.height && second.y < first.y + first.height,
      ),
    );
  const manyFlows = ["a", "b", "c", "d", "e", "f", "g"].map((id, index) => flow(id, null, 2 + (index % 4)));
  const aroundObstacle = buildOperationMap({ workflows: manyFlows, folderOrder: [], sizeOfStep, savedPositions: { d: { x: 200, y: 60 } } });
  check("CA-3 os automáticos se encaixam em volta de um arrastado, sem sobrepor", !anyOverlap(aroundObstacle) && aroundObstacle.find((group) => group.workflowId === "d")!.x === 200);
  const stacked = buildOperationMap({ workflows: manyFlows, folderOrder: [], sizeOfStep, savedPositions: Object.fromEntries(manyFlows.map((workflow, index) => [workflow.id, { x: 0, y: index * 30 }])) });
  check("CA-3 arrastados que ficaram um sobre o outro se afastam", !anyOverlap(stacked));
  const richSize = () => ({ width: 250, height: 250 });
  const tight: MapWorkflowInput = { ...flow("t", null, 4), nodes: flow("t", null, 4).nodes.map((node, index) => ({ ...node, position: { x: index * 90, y: 0 } })) };
  const tightGroup = buildOperationMap({ workflows: [tight], folderOrder: [], sizeOfStep: richSize })[0];
  check("CA-3 passos colados no editor não ficam um sobre o outro na visão Visual", !anyOverlap(tightGroup.steps));
  const ordering = buildOperationMap({
    workflows: [{ ...flow("z-desligado", null, 2) }, { ...flow("b-ativo", null, 2), isActive: true }, { ...flow("a-ativo", null, 2), isActive: true }],
    folderOrder: [],
    sizeOfStep,
  });
  check("CA-1 ativos primeiro e em ordem de nome", ordering.map((group) => group.workflowId).join() === "a-ativo,b-ativo,z-desligado");

  // Menu do atendimento no mapa (ajuste de 2026-10-11).
  const taggedFlow = (id: string, triggerTagId: string, appliedTagId?: string) => ({
    id,
    nodes: [
      { type: "LEAD_TAGGED", data: { action: { tagIds: [triggerTagId], conditions: [] } } },
      { type: "SEND_MESSAGE", data: {} },
      ...(appliedTagId ? [{ type: "TAG", data: { action: { type: "ADD", tagsIds: [appliedTagId] } } }] : []),
    ],
  });
  const attendanceFlows = [taggedFlow("f-catarata", "tag-catarata"), taggedFlow("f-refrativa", "tag-refrativa", "tag-pos"), taggedFlow("f-pos", "tag-pos"), { id: "f-sem-tag", nodes: [{ type: "NEW_LEAD", data: {} }] }];
  const scriptMenu = { id: "m1", name: "Menu inicial do atendimento", isActive: true, buttons: [{ id: "b1", text: "Cirurgia Refrativa", tagId: "tag-refrativa" }, { id: "b2", text: "Cirurgia de Catarata", tagId: "tag-catarata" }, { id: "b3", text: "Outro assunto" }] };
  const attendance = buildAttendanceMap({
    menus: [scriptMenu, { id: "m2", name: "Menu sem fluxo", isActive: true, buttons: [{ id: "x", text: "Sim" }] }, { id: "m3", name: "Menu desligado", isActive: false, buttons: [{ id: "y", text: "A", tagId: "tag-catarata" }] }],
    workflows: attendanceFlows,
    scriptMenuName: "Menu inicial do atendimento",
    hasBookingMenu: true,
  });
  check("menu do roteiro entra; menu sem fluxo e menu desligado ficam de fora", attendance.menus.length === 1 && attendance.menus[0].id === "m1");
  check("cada opção com tag liga ao fluxo que começa por ela", attendance.menuLinks.length === 2 && attendance.menuLinks.some((link) => link.optionId === "b1" && link.workflowId === "f-refrativa") && attendance.menuLinks.some((link) => link.optionId === "b2" && link.workflowId === "f-catarata"));
  check("com agendamento por botões, entram Agendar consulta e Meus horários", attendance.menus[0].options.filter((option) => option.kind === "booking").length === 2 && attendance.bookingLinks.length === 2 && attendance.bookingBlock !== null);
  check("opção sem tag aparece, sem ligação", attendance.menus[0].options.some((option) => option.id === "b3" && option.kind === "plain"));
  check("fluxo que aplica uma tag liga ao fluxo que começa por ela", attendance.tagLinks.length === 1 && attendance.tagLinks[0].fromWorkflowId === "f-refrativa" && attendance.tagLinks[0].toWorkflowId === "f-pos");
  check("os fluxos ligados saem na ordem das opções do menu", attendance.linkedWorkflowOrder.join() === "f-refrativa,f-catarata");
  check("a coluna dos menus fica à esquerda dos fluxos", attendance.menus[0].x + attendance.menus[0].width < 0);
  const withoutBooking = buildAttendanceMap({ menus: [scriptMenu], workflows: attendanceFlows, scriptMenuName: "Menu inicial do atendimento", hasBookingMenu: false });
  check("sem agendamento por botões, não há linhas nem bloco de agendamento", withoutBooking.bookingLinks.length === 0 && withoutBooking.bookingBlock === null && withoutBooking.menus[0].options.length === 3);
  check("funil sem menu nenhum não ganha retângulo", buildAttendanceMap({ menus: [], workflows: attendanceFlows, scriptMenuName: "x", hasBookingMenu: true }).menus.length === 0);
  const preferred = buildOperationMap({ workflows: [flow("a", null, 2), flow("b", null, 2), flow("c", null, 2)], folderOrder: [], sizeOfStep, preferredOrder: ["c", "a"] });
  check("fluxos ligados ao menu vêm primeiro, na ordem pedida", preferred.map((group) => group.workflowId).join() === "c,a,b");

  // Disposição inteligente em volta do menu (ajuste de 2026-10-11, depois do print do Weydson).
  const columnOrder = ["c", "a", "f", "b", "e", "d"];
  const columnFlows = columnOrder.map((id, index) => ({ ...flow(id, null, 2 + (index % 3)), isActive: true }));
  const looseFlows = [flow("x", null, 3), flow("y", null, 4)];
  const menuForColumn = { id: "m", name: "Menu inicial do atendimento", isActive: true, buttons: columnOrder.map((id) => ({ id: `o-${id}`, text: id, tagId: `tag-${id}` })) };
  const columnAttendance = buildAttendanceMap({
    menus: [menuForColumn],
    workflows: columnOrder.map((id) => ({ id, nodes: [{ type: "LEAD_TAGGED", data: { action: { tagIds: [`tag-${id}`] } } }] })),
    scriptMenuName: "Menu inicial do atendimento",
    hasBookingMenu: true,
  });
  check("mais de três fluxos: um para cada lado do menu, alternando", columnAttendance.rightWorkflowOrder.join() === "c,f,e" && columnAttendance.leftWorkflowOrder.join() === "a,b,d");
  const fewFlows = buildAttendanceMap({ menus: [{ ...menuForColumn, buttons: menuForColumn.buttons.slice(0, 3) }], workflows: columnOrder.slice(0, 3).map((id) => ({ id, nodes: [{ type: "LEAD_TAGGED", data: { action: { tagIds: [`tag-${id}`] } } }] })), scriptMenuName: "Menu inicial do atendimento", hasBookingMenu: false });
  check("até três fluxos ficam todos de um lado só", fewFlows.rightWorkflowOrder.length === 3 && fewFlows.leftWorkflowOrder.length === 0);

  const columnParams = {
    workflows: [...looseFlows, ...columnFlows],
    folderOrder: [],
    sizeOfStep,
    preferredOrder: columnOrder,
    menuColumns: {
      right: columnAttendance.rightWorkflowOrder,
      left: columnAttendance.leftWorkflowOrder,
      leftColumnRightEdge: LEFT_COLUMN_RIGHT_EDGE,
      centerStackHeight: centerStackHeight(columnAttendance),
      centerStackLeft: CENTER_STACK.left,
      centerStackWidth: CENTER_STACK.width,
    },
  };
  const columnLayout = layoutOperationMap(columnParams);
  const columnGroups = columnLayout.groups;
  const groupOf = (id: string) => columnGroups.find((group) => group.workflowId === id)!;
  const rightGroups = columnAttendance.rightWorkflowOrder.map(groupOf);
  const leftGroups = columnAttendance.leftWorkflowOrder.map(groupOf);
  check("coluna da direita começa colada ao corredor do menu", rightGroups.every((group) => group.x === 0));
  check("coluna da esquerda fica alinhada pela borda direita", leftGroups.every((group) => Math.abs(group.x + group.width - LEFT_COLUMN_RIGHT_EDGE) < 0.5));
  check("em cada coluna, a ordem é a das opções do menu, de cima para baixo", [rightGroups, leftGroups].every((column) => column.every((group, index) => index === 0 || group.y > column[index - 1].y)));
  const placedMenu = placeAttendance(columnAttendance, columnGroups, columnLayout.centerY);
  const menuBox = placedMenu.menus[0];
  const everyBox = [...columnGroups, ...placedMenu.menus, placedMenu.bookingBlock!, placedMenu.assistantBlock!];
  check("nenhum retângulo fica em cima de outro (fluxos, menu, agendamento e assistente)", !anyOverlap(everyBox));
  const centerBottom = placedMenu.assistantBlock!.y + placedMenu.assistantBlock!.height;
  check("os demais fluxos ficam abaixo das colunas e do menu", looseFlows.every((looseFlow) => groupOf(looseFlow.id).y > Math.max(centerBottom, ...rightGroups.map((group) => group.y + group.height), ...leftGroups.map((group) => group.y + group.height))));
  const columnsCenter = (Math.min(...[...rightGroups, ...leftGroups].map((group) => group.y)) + Math.max(...[...rightGroups, ...leftGroups].map((group) => group.y + group.height))) / 2;
  check("o menu e os blocos ficam centrados na altura das colunas", Math.abs((menuBox.y + centerBottom) / 2 - columnsCenter) < 1);
  check("uma linha por opção ligada, cada uma no corredor do lado do seu fluxo", placedMenu.menuEdges.length === 6 && placedMenu.menuEdges.every((edge) => (edge.side === "right" ? edge.channelX > menuBox.x + menuBox.width && edge.channelX < 0 : edge.channelX < menuBox.x && edge.channelX > LEFT_COLUMN_RIGHT_EDGE)));
  // Duas linhas se cruzam quando o trecho vertical de uma corta o trecho horizontal de saída ou de chegada da outra.
  const isBetween = (value: number, first: number, second: number) => value > Math.min(first, second) + 0.5 && value < Math.max(first, second) - 0.5;
  let crossingCount = 0;
  for (const side of ["left", "right"] as const) {
    const direction = side === "right" ? 1 : -1;
    const routed = placedMenu.menuEdges
      .filter((edge) => edge.side === side)
      .map((edge) => ({ distance: (edge.channelX - (side === "right" ? menuBox.x + menuBox.width : menuBox.x)) * direction, sourceY: menuBox.y + menuBox.options.find((option) => option.id === edge.optionId)!.centerY, targetY: groupOf(edge.workflowId).y + groupOf(edge.workflowId).height / 2 }));
    for (const vertical of routed) {
      for (const other of routed) {
        if (other === vertical) continue;
        if (isBetween(other.sourceY, vertical.sourceY, vertical.targetY) && other.distance > vertical.distance) crossingCount += 1;
        if (isBetween(other.targetY, vertical.sourceY, vertical.targetY) && other.distance < vertical.distance) crossingCount += 1;
      }
    }
  }
  check("nenhuma linha do menu cruza outra", crossingCount === 0, `${crossingCount} cruzamento(s)`);
  const bookingBox = placedMenu.bookingBlock!;
  check("o agendamento fica logo abaixo do menu e as linhas descem retas até ele", bookingBox.y > menuBox.y + menuBox.height && placedMenu.bookingEdges.length === 2 && placedMenu.bookingEdges.every((edge) => edge.channelX > bookingBox.x && edge.channelX < bookingBox.x + bookingBox.width));
  const nearestFlowChannel = Math.min(...placedMenu.menuEdges.filter((edge) => edge.side === "right").map((edge) => edge.channelX));
  check("as linhas dos fluxos passam por fora do bloco de agendamento", nearestFlowChannel > bookingBox.x + bookingBox.width && nearestFlowChannel > Math.max(...placedMenu.bookingEdges.map((edge) => edge.channelX)));
  const longestRun = Math.max(...placedMenu.menuEdges.map((edge) => Math.abs(menuBox.y + menuBox.options.find((option) => option.id === edge.optionId)!.centerY - (groupOf(edge.workflowId).y + groupOf(edge.workflowId).height / 2))));
  const singleColumnHeight = columnFlows.length * 220;
  check("com duas colunas, a linha mais longa é bem menor que numa coluna só", longestRun < singleColumnHeight / 2, `${Math.round(longestRun)} de altura`);

  // "Nunca permita uma pasta ficar em cima da outra": arrastar para cima de qualquer coisa não sobrepõe.
  const boxesOf = (layout: ReturnType<typeof layoutOperationMap>) => {
    const placedAround = placeAttendance(columnAttendance, layout.groups, layout.centerY);
    return [...layout.groups, ...placedAround.menus, placedAround.bookingBlock!, placedAround.assistantBlock!];
  };
  const ontoColumnFlow = layoutOperationMap({ ...columnParams, savedPositions: { x: { x: groupOf("c").x + 20, y: groupOf("c").y + 20 } } });
  check("soltar um fluxo em cima de outro da coluna: ele desce até caber", !anyOverlap(boxesOf(ontoColumnFlow)));
  const ontoMenu = layoutOperationMap({ ...columnParams, savedPositions: { y: { x: menuBox.x - 40, y: menuBox.y + 30 } } });
  check("soltar um fluxo em cima do menu: ele desce até caber", !anyOverlap(boxesOf(ontoMenu)));
  const columnFlowDragged = layoutOperationMap({ ...columnParams, savedPositions: { c: { x: groupOf("f").x + 10, y: groupOf("f").y + 10 } } });
  check("arrastar um fluxo da coluna para cima do vizinho não sobrepõe", !anyOverlap(boxesOf(columnFlowDragged)));
  const pileUp = layoutOperationMap({ ...columnParams, savedPositions: Object.fromEntries(columnParams.workflows.map((workflow) => [workflow.id, { x: 0, y: 0 }])) });
  check("todos os fluxos soltos no mesmo ponto: nenhum fica em cima de outro nem do menu", !anyOverlap(boxesOf(pileUp)));

  const saved = await prisma.workflow.findMany({
    where: { trackingId: { not: null } },
    select: { id: true, name: true, isActive: true, agentMode: true, folderId: true, trackingId: true, nodes: { select: { id: true, type: true, position: true, data: true } }, connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } } },
  });
  const byTracking = new Map<string, MapWorkflowInput[]>();
  for (const workflow of saved) byTracking.set(workflow.trackingId!, [...(byTracking.get(workflow.trackingId!) ?? []), workflow as unknown as MapWorkflowInput]);
  let savedGroups = 0;
  for (const workflows of byTracking.values()) savedGroups += buildOperationMap({ workflows, folderOrder: [], sizeOfStep }).length;
  check("CA-6 todos os fluxos salvos viram mapa sem erro", savedGroups === saved.length, `${saved.length} fluxos em ${byTracking.size} funis`);

  console.log(`TUDO CERTO (${checks} verificações)`);
}
main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
