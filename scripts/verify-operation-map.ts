// Confere o mapa da operação e os trechos por etapa (spec 0092). Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-operation-map.ts
import "./astro-qa/load-env";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { splitFlowIntoStageSections } from "../src/features/workflows/lib/flow-stage-sections";
import { buildOperationMap, type MapWorkflowInput } from "../src/features/workflows/lib/operation-map-graph";

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
