// Confere a previsão de erros dos fluxos (spec 0090, seção C). Somente leitura.
// Rodar: pnpm tsx --conditions=react-server scripts/verify-flow-diagnostics.ts
import assert from "node:assert/strict";
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { diagnoseFlow, type FlowEdgeInput, type FlowNodeInput } from "../src/features/workflows/lib/flow-diagnostics";

const text = (id: string, extra: Record<string, unknown> = {}): FlowNodeInput => ({
  id,
  type: "SEND_MESSAGE",
  data: { action: { target: { sendMode: "LEAD" }, payload: { type: "TEXT", message: "Oi" }, ...extra } },
});
const wait = (id: string, action: Record<string, unknown>): FlowNodeInput => ({ id, type: "WAIT", data: { action } });
const chain = (...ids: string[]): FlowEdgeInput[] => ids.slice(1).map((target, index) => ({ id: `e${index}-${ids[index]}-${target}`, source: ids[index], target }));
const codes = (nodes: FlowNodeInput[], edges: FlowEdgeInput[], provider: "meta" | "uazapi" | "none") =>
  diagnoseFlow(nodes, edges, { provider }).map((diagnostic) => `${diagnostic.nodeId}:${diagnostic.severity}:${diagnostic.code}`);

let checks = 0;
function check(label: string, actual: string[], expected: string[]) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
  checks += 1;
  console.log(`ok    ${label}`);
}

async function main() {
  const tagTrigger: FlowNodeInput = { id: "t", type: "LEAD_TAGGED", data: { action: { tagIds: ["x"] } } };
  const messageTrigger: FlowNodeInput = { id: "t", type: "MESSAGE_INCOMING", data: {} };

  check("CA-4 espera de 25 h + texto na API oficial é erro", codes([messageTrigger, text("a"), wait("w", { type: "HOURS", hours: 25 }), text("b")], chain("t", "a", "w", "b"), "meta"), ["b:error:META_WINDOW_NEEDS_TEMPLATE"]);
  check("CA-4 com template reserva não há erro", codes([messageTrigger, wait("w", { type: "DAYS", days: 2, hours: 9, minutes: 0 }), text("b", { fallbackTemplate: { templateName: "lembrete" } })], chain("t", "w", "b"), "meta"), []);
  check("CA-5 o mesmo fluxo em número não oficial não tem erro", codes([messageTrigger, wait("w", { type: "DAYS", days: 2 }), text("b")], chain("t", "w", "b"), "uazapi"), []);
  check("cliente acabou de escrever: texto imediato passa", codes([messageTrigger, text("a")], chain("t", "a"), "meta"), []);
  check("gatilho de tag + texto é aviso, não erro", codes([tagTrigger, text("a")], chain("t", "a"), "meta"), ["a:warning:META_WINDOW_MAY_BE_CLOSED"]);
  check("gatilho de tag + espera de 2 dias + texto é erro", codes([tagTrigger, wait("w", { type: "days", days: 2 }), text("b")], chain("t", "w", "b"), "meta"), ["b:error:META_WINDOW_NEEDS_TEMPLATE"]);
  check("esperas curtas somadas passam de 24 h", codes([messageTrigger, wait("w1", { type: "HOURS", hours: 13 }), wait("w2", { type: "HOURS", hours: 13 }), text("b")], chain("t", "w1", "w2", "b"), "meta"), ["b:error:META_WINDOW_NEEDS_TEMPLATE"]);
  check("esperar resposta por 2 dias: o lembrete avisa que sem resposta não entrega", codes([messageTrigger, text("a"), { id: "e", type: "WAIT_FOR_EVENT", data: { eventNames: ["message-incoming"], timeoutMinutes: 2880 } }, text("b")], chain("t", "a", "e", "b"), "meta"), ["b:warning:META_WINDOW_CLOSED_IF_NO_REPLY"]);
  check("esperar resposta por 2 horas: aviso genérico, uma vez", codes([messageTrigger, text("a"), { id: "e", type: "WAIT_FOR_EVENT", data: { eventNames: ["message-incoming"], timeoutMinutes: 120 } }, text("b"), text("c")], chain("t", "a", "e", "b", "c"), "meta"), ["b:warning:META_WINDOW_MAY_BE_CLOSED"]);
  check("menu de botões na API oficial é erro", codes([messageTrigger, text("a", { payload: { type: "BUTTONS", buttons: [{ text: "Sim", id: "1" }] } })], chain("t", "a"), "meta"), ["a:error:META_BUTTONS_BLOCKED"]);
  check("menu de botões em número não oficial passa", codes([messageTrigger, text("a", { payload: { type: "BUTTONS", buttons: [{ text: "Sim", id: "1" }] } })], chain("t", "a"), "uazapi"), []);
  check("template em número não oficial é erro", codes([messageTrigger, text("a", { payload: { type: "TEMPLATE", templateName: "x" } })], chain("t", "a"), "uazapi"), ["a:error:TEMPLATE_NEEDS_OFFICIAL_NUMBER"]);
  check("voz na API oficial é erro", codes([messageTrigger, { id: "v", type: "SEND_VOICE", data: { text: "oi" } }], chain("t", "v"), "meta"), ["v:error:META_VOICE_UNSUPPORTED"]);
  check("mensagem para outro número não entra na regra das 24 h", codes([tagTrigger, text("a", { target: { sendMode: "CUSTOM", phone: "8699" } })], chain("t", "a"), "meta"), []);
  check("funil sem número: um aviso só", codes([tagTrigger, text("a"), text("b")], chain("t", "a", "b"), "none"), ["a:warning:NO_NUMBER_CONNECTED"]);
  check("quadro solto (sem gatilho antes) não gera regra de janela", codes([text("a")], [], "meta"), []);
  check("laço termina", codes([messageTrigger, text("a"), wait("w", { type: "hours", hours: 30 })], [...chain("t", "a", "w"), { id: "back", source: "w", target: "a" }], "meta"), ["a:error:META_WINDOW_NEEDS_TEMPLATE"]);

  const erroDeLinha = diagnoseFlow([messageTrigger, wait("w", { type: "days", days: 2 }), text("b"), text("c")], chain("t", "w", "b", "c"), { provider: "meta" });
  assert.deepEqual(erroDeLinha.find((diagnostic) => diagnostic.nodeId === "b")?.edgeIds.length, 2, "linhas que chegam e saem do quadro com erro");
  console.log("ok    linhas que chegam e saem do quadro com erro vêm no diagnóstico");

  // CA-1: todos os fluxos salvos passam pelo diagnóstico sem estourar erro (somente leitura).
  const workflows = await prisma.workflow.findMany({
    where: { trackingId: { not: null } },
    select: { id: true, nodes: { select: { id: true, type: true, data: true } }, connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } } },
  });
  const totals = { fluxos: 0, comErro: 0, comAviso: 0 };
  const byCode: Record<string, number> = {};
  for (const workflow of workflows) {
    const edges = workflow.connections.map((connection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId, sourceHandle: connection.fromOutput }));
    for (const provider of ["meta", "uazapi", "none"] as const) diagnoseFlow(workflow.nodes, edges, { provider });
    const onMeta = diagnoseFlow(workflow.nodes, edges, { provider: "meta" });
    totals.fluxos += 1;
    if (onMeta.some((diagnostic) => diagnostic.severity === "error")) totals.comErro += 1;
    else if (onMeta.length > 0) totals.comAviso += 1;
    for (const diagnostic of onMeta) byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
  }
  console.log(`ok    CA-1 ${totals.fluxos} fluxos salvos lidos sem erro de execução`);
  console.log(`      se todos estivessem na API oficial: ${totals.comErro} com erro, ${totals.comAviso} só com aviso · ${JSON.stringify(byCode)}`);
  console.log(`TUDO CERTO (${checks + 2} verificações)`);
}
main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
