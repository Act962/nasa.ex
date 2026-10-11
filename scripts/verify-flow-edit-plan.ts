// Confere o núcleo da edição de fluxo pelo Astro (spec 0094): validação e aplicação do plano. Puro:
// sem banco e sem IA.
import {
  DECIDE_LATER_ANSWER,
  MAX_FLOW_STEPS,
  applyFlowEditPlan,
  applyQuestionAnswer,
  flowEditPlanSchema,
  mergeStepData,
  summarizeFlowForModel,
  type FlowEditPlan,
  type FlowSnapshot,
} from "../src/features/workflows/lib/flow-edit-plan";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

let idCounter = 0;
const context = {
  triggerTypes: new Set(["LEAD_TAGGED", "NEW_LEAD"]),
  insertableTypes: new Set(["SEND_MESSAGE", "SEND_AGENDA", "WAIT", "TAG", "MOVE_LEAD"]),
  labelOfType: (stepType: string) => ({ SEND_MESSAGE: "Enviar Mensagem", SEND_AGENDA: "Enviar agenda", WAIT: "Esperar", LEAD_TAGGED: "Lead recebeu tag" })[stepType] ?? stepType,
  newId: () => `novo${(idCounter += 1)}`,
};
const flow: FlowSnapshot = {
  steps: [
    { id: "t", type: "LEAD_TAGGED", name: "LEAD_TAGGED", position: { x: 0, y: 0 }, data: {} },
    { id: "m", type: "SEND_MESSAGE", name: "Boas-vindas", position: { x: 320, y: 0 }, data: { action: { payload: { type: "TEXT", message: "Olá" } } } },
    { id: "w", type: "WAIT", name: "WAIT", position: { x: 640, y: 0 }, data: { action: { type: "hours", hours: 2 } } },
  ],
  links: [
    { id: "l1", fromNodeId: "t", toNodeId: "m", fromOutput: "main" },
    { id: "l2", fromNodeId: "m", toNodeId: "w", fromOutput: "main" },
  ],
};
const insertAgenda: FlowEditPlan = {
  operations: [{ kind: "insert_step", newStepId: "a", afterStepId: "m", stepType: "SEND_AGENDA", data: { action: { agendaId: "needsReview", messageTemplate: "Marque aqui" }, needsReview: true } }],
  questions: [{ kind: "agenda", operationIndex: 0 }],
};

// CA-2: inserir no meio do caminho.
const inserted = applyFlowEditPlan(flow, insertAgenda, context);
check("CA-2 inserir depois de um passo cria o passo novo", inserted.ok && inserted.flow.steps.length === 4);
if (inserted.ok) {
  const newStep = inserted.flow.steps.find((step) => step.type === "SEND_AGENDA")!;
  const hasIn = inserted.flow.links.some((link) => link.fromNodeId === "m" && link.toNodeId === newStep.id);
  const hasOut = inserted.flow.links.some((link) => link.fromNodeId === newStep.id && link.toNodeId === "w");
  const hasOld = inserted.flow.links.some((link) => link.fromNodeId === "m" && link.toNodeId === "w");
  check("CA-2 o passo novo entra no meio: antes → novo → depois", hasIn && hasOut && !hasOld);
  check("CA-2 o passo seguinte abre espaço", inserted.flow.steps.find((step) => step.id === "w")!.position.x > newStep.position.x - 1);
  check("CA-2 o fluxo original não foi alterado", flow.steps.length === 3 && flow.links.length === 2);
}

// CA-2 e CA-3: resposta da pergunta.
const answered = applyQuestionAnswer(insertAgenda, 0, { id: "agenda123" });
const answeredData = (answered.operations[0] as { data: Record<string, unknown> }).data;
check("CA-2 escolher a agenda preenche o passo e tira o vermelho", (answeredData.action as { agendaId: string }).agendaId === "agenda123" && answeredData.needsReview === undefined);
check("CA-2 a resposta mantém o resto do passo", (answeredData.action as { messageTemplate: string }).messageTemplate === "Marque aqui");
const later = applyQuestionAnswer(insertAgenda, 0, "later");
check("CA-3 \"Decidir depois\" mantém o passo em vermelho", (later.operations[0] as { data: Record<string, unknown> }).data.needsReview === true && DECIDE_LATER_ANSWER.length > 0);
const anchorPlan: FlowEditPlan = { operations: [{ ...insertAgenda.operations[0] }], questions: [{ kind: "anchor_step", operationIndex: 0 }] };
check("CA-1 escolher o passo de referência muda onde o novo entra", (applyQuestionAnswer(anchorPlan, 0, { id: "w" }).operations[0] as { afterStepId: string }).afterStepId === "w");

// CA-8: operações inválidas não passam.
const refused = (plan: FlowEditPlan) => !applyFlowEditPlan(flow, plan, context).ok;
check("CA-8 passo de referência inexistente é recusado", refused({ operations: [{ ...insertAgenda.operations[0], afterStepId: "nao-existe" } as never], questions: [] }));
check("CA-8 inserir um gatilho é recusado", refused({ operations: [{ ...insertAgenda.operations[0], stepType: "NEW_LEAD" } as never], questions: [] }));
check("CA-8 tipo fora da lista é recusado", refused({ operations: [{ ...insertAgenda.operations[0], stepType: "HTTP_REQUEST" } as never], questions: [] }));
check("CA-8 ligação que fecha círculo é recusada", refused({ operations: [{ kind: "reconnect", fromStepId: "w", toStepId: "m" }], questions: [] }));
check("CA-8 nada entra num gatilho", refused({ operations: [{ kind: "reconnect", fromStepId: "w", toStepId: "t" }], questions: [] }));
check("CA-8 remover o único gatilho é recusado", refused({ operations: [{ kind: "remove_step", stepId: "t" }], questions: [] }));
check("CA-8 plano vazio é recusado", refused({ operations: [], questions: [] }));
check("CA-8 operação desconhecida não passa no formato", !flowEditPlanSchema.safeParse({ operations: [{ kind: "delete_everything" }], questions: [] }).success);
check("CA-8 mais operações que o teto não passa no formato", !flowEditPlanSchema.safeParse({ operations: Array.from({ length: 7 }, () => ({ kind: "remove_step", stepId: "m" })), questions: [] }).success);
check("CA-8 pergunta de tipo desconhecido não passa no formato", !flowEditPlanSchema.safeParse({ operations: [], questions: [{ kind: "senha", operationIndex: 0 }] }).success);

// Remover e alterar.
const removed = applyFlowEditPlan(flow, { operations: [{ kind: "remove_step", stepId: "m" }], questions: [] }, context);
check("remover um passo liga o anterior no seguinte", removed.ok && removed.flow.steps.length === 2 && removed.flow.links.some((link) => link.fromNodeId === "t" && link.toNodeId === "w"));
const updated = applyFlowEditPlan(flow, { operations: [{ kind: "update_step", stepId: "w", data: { action: { hours: 5 } } }], questions: [] }, context);
check("alterar um passo muda só o campo pedido", updated.ok && JSON.stringify(updated.flow.steps.find((step) => step.id === "w")!.data) === JSON.stringify({ action: { type: "hours", hours: 5 } }));
check("juntar dados substitui lista inteira", JSON.stringify(mergeStepData({ action: { tagsIds: ["a", "b"] } }, { action: { tagsIds: ["c"] } })) === JSON.stringify({ action: { tagsIds: ["c"] } }));
const chained = applyFlowEditPlan(
  flow,
  { operations: [{ kind: "insert_step", newStepId: "x", afterStepId: "w", stepType: "WAIT", data: {} }, { kind: "insert_step", newStepId: "y", afterStepId: "x", stepType: "SEND_MESSAGE", data: {} }], questions: [] },
  context,
);
check("uma operação pode apontar para um passo criado pela anterior", chained.ok && chained.flow.steps.length === 5 && chained.flow.links.length === 4);

// CB-6: limite de passos.
const fullFlow: FlowSnapshot = { steps: Array.from({ length: MAX_FLOW_STEPS }, (_, index) => ({ id: `s${index}`, type: index === 0 ? "LEAD_TAGGED" : "WAIT", name: "x", position: { x: index * 320, y: 0 }, data: {} })), links: [] };
check("CB-6 fluxo no limite recusa inserir", !applyFlowEditPlan(fullFlow, { operations: [{ ...insertAgenda.operations[0], afterStepId: "s1" } as never], questions: [] }, context).ok);

// Segurança: o resumo para o modelo não leva posição nem id de ligação, só o necessário.
const summary = summarizeFlowForModel(flow);
check("o resumo para o modelo traz passos e ligações, sem posição", summary.steps.length === 3 && !("position" in summary.steps[0]) && summary.links.length === 2);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
