import "server-only";
import prisma from "@/lib/prisma";
import { buildPickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";
import { DECIDE_LATER_ANSWER, type FlowEditPlan, type FlowQuestionKind, type FlowSnapshot } from "@/features/workflows/lib/flow-edit-plan";

// Perguntas do Astro ao montar ou editar um fluxo (spec 0094, RF-5 e RF-6). O modelo só diz o tipo da
// pergunta; as opções saem daqui, de consultas filtradas pela empresa e pelo funil. É também aqui que
// a resposta é conferida: id que não está entre as opções é recusado.

const MAX_OPTIONS = 12;
/** Empresa costuma ter muitas tags: cortar em 12 esconderia a que a pessoa quer. */
const MAX_TAG_OPTIONS = 40;

interface QuestionOption {
  id: string;
  label: string;
}

export interface FlowEditQuestionCard {
  title: string;
  description: string;
  options: QuestionOption[];
  picker: AstroPicker;
}

const QUESTION_TEXT: Record<FlowQuestionKind, { title: string; question: string; empty: string }> = {
  agenda: { title: "Qual agenda?", question: "Qual agenda o fluxo deve enviar para o cliente marcar?", empty: "Este funil não tem agenda ativa." },
  tag: { title: "Qual tag?", question: "Qual tag este passo deve usar?", empty: "A empresa ainda não tem tags." },
  status: { title: "Qual coluna?", question: "Para qual coluna do funil o lead deve ir?", empty: "Este funil não tem colunas." },
  member: { title: "Quem é o responsável?", question: "Quem da equipe este passo deve usar?", empty: "Não achei pessoas na equipe." },
  anchor_step: { title: "Em que ponto do fluxo?", question: "Depois de qual passo o novo deve entrar?", empty: "O fluxo não tem passos." },
};

async function loadOptions(params: {
  kind: FlowQuestionKind;
  organizationId: string;
  trackingId: string;
  flow: FlowSnapshot;
  labelOfStep: (stepType: string) => string;
}): Promise<QuestionOption[]> {
  const { kind, organizationId, trackingId } = params;
  if (kind === "agenda") {
    const agendas = await prisma.agenda.findMany({ where: { organizationId, trackingId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: MAX_OPTIONS });
    return agendas.map((agenda) => ({ id: agenda.id, label: agenda.name }));
  }
  if (kind === "tag") {
    const tags = await prisma.tag.findMany({ where: { organizationId, OR: [{ trackingId }, { trackingId: null }] }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: MAX_TAG_OPTIONS });
    return tags.map((tag) => ({ id: tag.id, label: tag.name }));
  }
  if (kind === "status") {
    const statuses = await prisma.status.findMany({ where: { trackingId }, select: { id: true, name: true }, orderBy: { order: "asc" }, take: MAX_OPTIONS });
    return statuses.map((status) => ({ id: status.id, label: status.name }));
  }
  if (kind === "member") {
    const participants = await prisma.trackingParticipant.findMany({ where: { trackingId }, select: { user: { select: { id: true, name: true } } }, take: MAX_OPTIONS });
    return participants.map((participant) => ({ id: participant.user.id, label: participant.user.name }));
  }
  // Passos do próprio fluxo, com a posição quando o rótulo se repete (CB-4).
  const labelCount = new Map<string, number>();
  return params.flow.steps.slice(0, MAX_OPTIONS).map((step, stepIndex) => {
    const baseLabel = step.name && step.name !== step.type ? step.name : params.labelOfStep(step.type);
    const seenBefore = labelCount.get(baseLabel) ?? 0;
    labelCount.set(baseLabel, seenBefore + 1);
    return { id: step.id, label: seenBefore > 0 || params.flow.steps.filter((other) => other.name === step.name && other.type === step.type).length > 1 ? `${baseLabel} (passo ${stepIndex + 1})` : baseLabel };
  });
}

/** O cartão de uma pergunta do plano, com as opções reais. */
export async function buildQuestionCard(params: {
  plan: FlowEditPlan;
  questionIndex: number;
  organizationId: string;
  trackingId: string;
  flow: FlowSnapshot;
  labelOfStep: (stepType: string) => string;
}): Promise<FlowEditQuestionCard> {
  const question = params.plan.questions[params.questionIndex];
  const loadedOptions = await loadOptions({ kind: question.kind, organizationId: params.organizationId, trackingId: params.trackingId, flow: params.flow, labelOfStep: params.labelOfStep });
  // No ponto do fluxo, o lugar que o Astro achou mais provável vem primeiro, marcado como sugestão.
  const operation = params.plan.operations[question.operationIndex];
  const suggestedStepId = question.kind === "anchor_step" && operation?.kind === "insert_step" ? operation.afterStepId : null;
  const suggested = loadedOptions.find((option) => option.id === suggestedStepId);
  const options = suggested
    ? [{ id: suggested.id, label: `${suggested.label} (sugestão do Astro)` }, ...loadedOptions.filter((option) => option.id !== suggested.id)]
    : loadedOptions;
  const text = QUESTION_TEXT[question.kind];
  const canDecideLater = question.kind !== "anchor_step";
  return {
    title: text.title,
    description: options.length === 0 ? `${text.empty} Posso deixar o passo em vermelho para você escolher depois no editor.` : text.question,
    options,
    picker: {
      kind: "select",
      options: [
        ...options.map((option) => ({ label: option.label, answer: buildPickedAnswer(option.label, option.id) })),
        ...(canDecideLater ? [{ label: "Decidir depois no editor", answer: DECIDE_LATER_ANSWER }] : []),
      ],
    },
  };
}
