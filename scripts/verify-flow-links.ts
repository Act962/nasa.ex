// Confere as regras de ligação entre fluxos (spec 0092, etapa 2). Rodar: pnpm tsx scripts/verify-flow-links.ts
import assert from "node:assert/strict";
import { HANDOFF_MODE, listFlowLinks, refuseFlowLink, type LinkableFlow } from "../src/features/workflows/lib/flow-links";

const flow = (id: string, agentMode: boolean, linksTo: string[] = []): LinkableFlow => ({
  id,
  agentMode,
  nodes: [
    { id: `${id}-t`, type: "LEAD_TAGGED", data: {} },
    ...linksTo.map((toWorkflowId, index) => ({ id: `${id}-h${index}`, type: "CALL_WORKFLOW", data: { workflowId: toWorkflowId, mode: HANDOFF_MODE } })),
  ],
});
let checks = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected, label);
  checks += 1;
  console.log(`ok    ${label}`);
};
const refuse = (flows: LinkableFlow[], fromWorkflowId: string, toWorkflowId: string) => refuseFlowLink({ flows, fromWorkflowId, toWorkflowId });

const flows = [flow("a", true, ["b"]), flow("b", true), flow("c", true), flow("classico", false)];
check("CA-8 ligação nova entre dois fluxos de modo agente é aceita", refuse(flows, "b", "c"), null);
check("CA-8 fluxo não segue para ele mesmo", refuse(flows, "a", "a"), "same-flow");
check("CA-8 fluxo fora do modo agente não liga", refuse(flows, "a", "classico"), "needs-agent-mode");
check("CA-8 ligação repetida é recusada", refuse(flows, "a", "b"), "already-linked");
check("CA-8 ligação que fecha círculo é recusada", refuse(flows, "b", "a"), "closes-a-circle");
check("CA-8 círculo por um fluxo intermediário também", refuse([flow("a", true, ["b"]), flow("b", true, ["c"]), flow("c", true)], "c", "a"), "closes-a-circle");
check("CA-8 fluxo de outro funil (fora da lista) é desconhecido", refuse(flows, "a", "de-outro-funil"), "unknown-flow");

const longChain = ["f1", "f2", "f3", "f4", "f5", "f6", "f7"].map((id, index, ids) => flow(id, true, index < 5 ? [ids[index + 1]] : []));
check("CA-8 sequência com mais de 5 passagens é recusada", refuse(longChain, "f6", "f7"), "too-deep");

check("CA-9 a ligação é lida do passo de passagem", listFlowLinks(flows), [{ fromWorkflowId: "a", toWorkflowId: "b", nodeId: "a-h0" }]);
check(
  "CA-9 chamada embutida (sem modo passagem) não vira ligação no mapa",
  listFlowLinks([{ id: "x", agentMode: true, nodes: [{ id: "n", type: "CALL_WORKFLOW", data: { workflowId: "b" } }] }, flow("b", true)]),
  [],
);
console.log(`TUDO CERTO (${checks} verificações)`);
