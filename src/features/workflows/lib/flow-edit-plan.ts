import { z } from "zod";
import { refuseConnection, REFUSAL_MESSAGES } from "@/features/editor/lib/connection-rules";

// Plano de edição de um fluxo pelo Astro (spec 0094): uma lista curta de operações sobre os passos
// que já existem, validada e aplicada por código. O modelo só propõe; nada aqui confia nele. Puro:
// recebe o fluxo e o plano e devolve o fluxo novo ou a recusa, para um script conferir tudo.

export const MAX_FLOW_STEPS = 40;
export const MAX_OPERATIONS = 6;
export const MAX_QUESTIONS = 3;
const MAIN_OUTPUT = "main";
const STEP_GAP_X = 320;

export interface FlowStep {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string;
}

export interface FlowSnapshot {
  steps: FlowStep[];
  links: FlowLink[];
}

const stepDataSchema = z.record(z.string(), z.unknown());

export const flowEditOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("insert_step"),
    /** Id provisório do passo novo, para outra operação do mesmo plano poder apontar para ele. */
    newStepId: z.string().min(1).max(40),
    /** Passo depois do qual o novo entra. */
    afterStepId: z.string().min(1).max(60),
    fromOutput: z.string().max(60).optional(),
    stepType: z.string().min(1).max(60),
    name: z.string().max(80).optional(),
    data: stepDataSchema,
  }),
  z.object({ kind: z.literal("remove_step"), stepId: z.string().min(1).max(60) }),
  z.object({ kind: z.literal("update_step"), stepId: z.string().min(1).max(60), data: stepDataSchema }),
  z.object({
    kind: z.literal("reconnect"),
    fromStepId: z.string().min(1).max(60),
    fromOutput: z.string().max(60).optional(),
    toStepId: z.string().min(1).max(60),
  }),
]);

export type FlowEditOperation = z.infer<typeof flowEditOperationSchema>;

/** O que o Astro pode perguntar. Cada tipo tem opções buscadas no banco, nunca escritas pelo modelo. */
export const FLOW_QUESTION_KINDS = ["agenda", "tag", "status", "member", "anchor_step"] as const;
export type FlowQuestionKind = (typeof FLOW_QUESTION_KINDS)[number];

export const flowEditQuestionSchema = z.object({
  kind: z.enum(FLOW_QUESTION_KINDS),
  /** Operação do plano a que a resposta se aplica. */
  operationIndex: z.number().int().min(0).max(MAX_OPERATIONS - 1),
});

export type FlowEditQuestion = z.infer<typeof flowEditQuestionSchema>;

export const flowEditPlanSchema = z.object({
  /** Preenchido quando o pedido não cabe nas operações previstas. */
  refusalReason: z.string().max(300).optional(),
  operations: z.array(flowEditOperationSchema).max(MAX_OPERATIONS),
  questions: z.array(flowEditQuestionSchema).max(MAX_QUESTIONS),
});

export type FlowEditPlan = z.infer<typeof flowEditPlanSchema>;

export type FlowEditOutcome = { ok: true; flow: FlowSnapshot; summary: string[] } | { ok: false; reason: string };

/** Resposta "Decidir depois no editor": o passo fica marcado para revisão, como na criação de hoje. */
export const DECIDE_LATER_ANSWER = "decidir-depois";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Junta os dados novos nos atuais, campo a campo. Lista é substituída inteira. */
export function mergeStepData(current: Record<string, unknown>, changes: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    merged[key] = isPlainObject(value) && isPlainObject(current[key]) ? mergeStepData(current[key] as Record<string, unknown>, value) : value;
  }
  return merged;
}

/** Aplica a resposta de uma pergunta na operação a que ela pertence. Devolve um plano novo. */
export function applyQuestionAnswer(plan: FlowEditPlan, questionIndex: number, answer: { id: string } | "later"): FlowEditPlan {
  const question = plan.questions[questionIndex];
  const operation = question ? plan.operations[question.operationIndex] : undefined;
  if (!question || !operation) return plan;

  const replaceOperation = (nextOperation: FlowEditOperation): FlowEditPlan => ({
    ...plan,
    operations: plan.operations.map((currentOperation, operationIndex) => (operationIndex === question.operationIndex ? nextOperation : currentOperation)),
  });

  if (question.kind === "anchor_step") {
    if (answer === "later" || operation.kind !== "insert_step") return plan;
    return replaceOperation({ ...operation, afterStepId: answer.id });
  }
  if (operation.kind !== "insert_step" && operation.kind !== "update_step") return plan;
  if (answer === "later") {
    return replaceOperation({ ...operation, data: { ...operation.data, needsReview: true } });
  }

  const actionPatch: Record<FlowQuestionKind, Record<string, unknown>> = {
    agenda: { action: { agendaId: answer.id } },
    tag: { action: { tagsIds: [answer.id] } },
    status: { action: { statusId: answer.id } },
    member: { action: { userId: answer.id } },
    anchor_step: {},
  };
  // A escolha foi feita: o passo deixa de estar marcado para revisão.
  const answeredData = mergeStepData(operation.data, actionPatch[question.kind]);
  delete answeredData.needsReview;
  delete answeredData.reviewReason;
  return replaceOperation({ ...operation, data: answeredData });
}

interface ApplyContext {
  triggerTypes: Set<string>;
  /** Tipos de passo que o Astro pode inserir (os de ação do painel; nunca gatilho). */
  insertableTypes: Set<string>;
  labelOfType: (stepType: string) => string;
  newId: () => string;
}

function labelOf(step: FlowStep | undefined, context: ApplyContext): string {
  if (!step) return "passo";
  const typeLabel = context.labelOfType(step.type);
  return step.name && step.name !== step.type ? `${typeLabel} (${step.name})` : typeLabel;
}

const MAX_DESCRIBED_CHANGES = 3;
const MAX_DESCRIBED_VALUE_CHARS = 60;

/** "hours → 5": os campos que mudam, em uma linha, para a pessoa conferir antes do "sim". */
function describeChanges(changes: Record<string, unknown>, prefix = ""): string {
  const leaves: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (isPlainObject(value)) {
      for (const [key, nested] of Object.entries(value)) visit(nested, key);
      return;
    }
    const text = typeof value === "string" ? value : JSON.stringify(value);
    leaves.push(`${path} → ${String(text).slice(0, MAX_DESCRIBED_VALUE_CHARS)}`);
  };
  visit(changes, prefix);
  const shown = leaves.slice(0, MAX_DESCRIBED_CHANGES).join(", ");
  return leaves.length > MAX_DESCRIBED_CHANGES ? `${shown} e mais ${leaves.length - MAX_DESCRIBED_CHANGES}` : shown || "sem campo novo";
}

function refuse(reason: string): FlowEditOutcome {
  return { ok: false, reason };
}

/**
 * Aplica o plano ao fluxo, uma operação por vez, recusando o plano inteiro ao primeiro problema:
 * passo que não existe, tipo que não pode ser inserido, ligação que fecha círculo ou entra em gatilho.
 */
export function applyFlowEditPlan(flow: FlowSnapshot, plan: FlowEditPlan, context: ApplyContext): FlowEditOutcome {
  if (plan.operations.length === 0) return refuse("Não entendi o que mudar neste fluxo.");

  let steps = flow.steps.map((step) => ({ ...step }));
  let links = flow.links.map((link) => ({ ...link }));
  const idOfNewStep = new Map<string, string>();
  const summary: string[] = [];
  const resolveId = (stepId: string) => idOfNewStep.get(stepId) ?? stepId;
  const findStep = (stepId: string) => steps.find((step) => step.id === resolveId(stepId));
  const refusalOfLink = (sourceId: string, targetId: string) =>
    refuseConnection({
      sourceId,
      targetId,
      nodes: steps.map((step) => ({ id: step.id, type: step.type })),
      edges: links.map((link) => ({ id: link.id, source: link.fromNodeId, target: link.toNodeId })),
      triggerTypes: context.triggerTypes,
    });

  for (const operation of plan.operations) {
    if (operation.kind === "insert_step") {
      const anchor = findStep(operation.afterStepId);
      if (!anchor) return refuse("O plano apontou para um passo que não existe neste fluxo.");
      if (!context.insertableTypes.has(operation.stepType)) return refuse(`O Astro não pode inserir um passo do tipo "${operation.stepType}".`);
      if (steps.length >= MAX_FLOW_STEPS) return refuse(`O fluxo já tem ${MAX_FLOW_STEPS} passos, que é o limite.`);

      const output = operation.fromOutput ?? MAIN_OUTPUT;
      const newStep: FlowStep = {
        id: context.newId(),
        type: operation.stepType,
        name: operation.name ?? operation.stepType,
        position: { x: anchor.position.x + STEP_GAP_X, y: anchor.position.y },
        data: operation.data,
      };
      idOfNewStep.set(operation.newStepId, newStep.id);
      // O que saía do passo de referência passa a sair do novo: ele entra no meio do caminho.
      const displaced = links.filter((link) => link.fromNodeId === anchor.id && link.fromOutput === output);
      const displacedIds = new Set(displaced.map((link) => link.id));
      const laterStepIds = new Set(displaced.map((link) => link.toNodeId));
      steps = steps.map((step) => (laterStepIds.has(step.id) && step.position.x <= newStep.position.x ? { ...step, position: { ...step.position, x: step.position.x + STEP_GAP_X } } : step));
      steps.push(newStep);
      links = [
        ...links.filter((link) => !displacedIds.has(link.id)),
        { id: context.newId(), fromNodeId: anchor.id, toNodeId: newStep.id, fromOutput: output },
        ...displaced.map((link) => ({ id: context.newId(), fromNodeId: newStep.id, toNodeId: link.toNodeId, fromOutput: MAIN_OUTPUT })),
      ];
      summary.push(`Inserir ${labelOf(newStep, context)} depois de ${labelOf(anchor, context)}${newStep.data.needsReview === true ? " (fica em vermelho até você escolher no editor)" : ""}.`);
      continue;
    }

    if (operation.kind === "remove_step") {
      const target = findStep(operation.stepId);
      if (!target) return refuse("O plano apontou para um passo que não existe neste fluxo.");
      const isTrigger = context.triggerTypes.has(target.type);
      if (isTrigger && steps.filter((step) => context.triggerTypes.has(step.type)).length === 1) {
        return refuse("Este é o único gatilho do fluxo: sem ele o fluxo nunca começa. Troque o gatilho no editor.");
      }
      const incoming = links.filter((link) => link.toNodeId === target.id);
      const outgoing = links.filter((link) => link.fromNodeId === target.id);
      links = links.filter((link) => link.fromNodeId !== target.id && link.toNodeId !== target.id);
      steps = steps.filter((step) => step.id !== target.id);
      // Passo de uma saída só: quem vinha antes passa a apontar para quem vinha depois.
      if (outgoing.length === 1) {
        for (const incomingLink of incoming) {
          const isDuplicate = links.some((link) => link.fromNodeId === incomingLink.fromNodeId && link.toNodeId === outgoing[0].toNodeId && link.fromOutput === incomingLink.fromOutput);
          if (!isDuplicate) links.push({ id: context.newId(), fromNodeId: incomingLink.fromNodeId, toNodeId: outgoing[0].toNodeId, fromOutput: incomingLink.fromOutput });
        }
      }
      summary.push(`Remover ${labelOf(target, context)}${outgoing.length > 1 ? " (as saídas dele ficam soltas: religue no editor)" : ""}.`);
      continue;
    }

    if (operation.kind === "update_step") {
      const target = findStep(operation.stepId);
      if (!target) return refuse("O plano apontou para um passo que não existe neste fluxo.");
      steps = steps.map((step) => (step.id === target.id ? { ...step, data: mergeStepData(step.data, operation.data) } : step));
      summary.push(`Alterar ${labelOf(target, context)}: ${describeChanges(operation.data)}.`);
      continue;
    }

    const source = findStep(operation.fromStepId);
    const target = findStep(operation.toStepId);
    if (!source || !target) return refuse("O plano apontou para um passo que não existe neste fluxo.");
    const output = operation.fromOutput ?? MAIN_OUTPUT;
    links = links.filter((link) => !(link.fromNodeId === source.id && link.fromOutput === output));
    const refusal = refusalOfLink(source.id, target.id);
    if (refusal) return refuse(REFUSAL_MESSAGES[refusal]);
    links.push({ id: context.newId(), fromNodeId: source.id, toNodeId: target.id, fromOutput: output });
    summary.push(`Ligar ${labelOf(source, context)} em ${labelOf(target, context)}.`);
  }

  // Conferência final do desenho inteiro: nenhuma ligação entra em gatilho nem fecha círculo.
  for (const link of links) {
    const withoutThisLink = links.filter((otherLink) => otherLink.id !== link.id);
    const refusal = refuseConnection({
      sourceId: link.fromNodeId,
      targetId: link.toNodeId,
      nodes: steps.map((step) => ({ id: step.id, type: step.type })),
      edges: withoutThisLink.map((otherLink) => ({ id: otherLink.id, source: otherLink.fromNodeId, target: otherLink.toNodeId })),
      triggerTypes: context.triggerTypes,
    });
    if (refusal) return refuse(REFUSAL_MESSAGES[refusal]);
  }
  return { ok: true, flow: { steps, links }, summary };
}

/** Resumo do fluxo para o modelo: só o que ele precisa para apontar passos, sem credencial nenhuma. */
export function summarizeFlowForModel(flow: FlowSnapshot): { steps: { id: string; type: string; name: string; data: unknown }[]; links: { from: string; to: string; output: string }[] } {
  return {
    steps: flow.steps.map((step) => ({ id: step.id, type: step.type, name: step.name, data: step.data })),
    links: flow.links.map((link) => ({ from: link.fromNodeId, to: link.toNodeId, output: link.fromOutput })),
  };
}
