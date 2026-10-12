// Confere as regras de ligação do editor de fluxos (spec 0090). Rodar: pnpm tsx scripts/verify-connection-rules.ts
import assert from "node:assert/strict";
import { refuseConnection } from "../src/features/editor/lib/connection-rules";

const nodes = [
  { id: "gatilho", type: "LEAD_TAGGED" },
  { id: "espera", type: "WAIT" },
  { id: "mensagem", type: "SEND_MESSAGE" },
  { id: "proposta", type: "SEND_PROPOSAL" },
  { id: "repeticao", type: "LOOP_OVER" },
];
const edges = [
  { id: "e1", source: "gatilho", target: "espera" },
  { id: "e2", source: "espera", target: "mensagem" },
  { id: "e3", source: "mensagem", target: "proposta" },
];
const triggerTypes = new Set(["LEAD_TAGGED"]);
const refuse = (sourceId: string, targetId: string, ignoreEdgeId?: string) =>
  refuseConnection({ sourceId, targetId, nodes, edges, triggerTypes, ignoreEdgeId });

assert.equal(refuse("proposta", "gatilho"), "into-trigger", "nada entra no gatilho");
assert.equal(refuse("proposta", "espera"), "closes-a-circle", "voltar para um passo anterior fecha círculo");
assert.equal(refuse("espera", "espera"), "same-node", "passo ligado nele mesmo");
assert.equal(refuse("gatilho", "proposta"), null, "atalho para a frente é permitido");
assert.equal(refuse("espera", "proposta", "e2"), null, "religar a ponta de uma ligação existente");
assert.equal(refuse("proposta", "repeticao"), null, "quadro de repetição pode fechar círculo");
console.log("TUDO CERTO (6 verificações)");
