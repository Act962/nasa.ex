// Blocos do editor do FlowAstro (spec 0139). Cada bloco é um NodeType com dados iniciais; alguns reaproveitam tipos
// das automações (Enviar Mensagem, Esperar, Etiqueta, Conectar fluxo) com o mesmo formato de dados, para o motor ser um só.
import { buttonOutputId, NO_CLICK_OUTPUT } from "@/features/workflows/lib/button-reply-flow";
import { CONDITION_OUTPUTS, conditionOutputLabels, parseCondition } from "./conditions";
import { attendanceNodeOutputs, NO_REPLY_OUTPUT, resolveReplyDeadline } from "./nodes";

export type BlockKey =
  | "start"
  | "message"
  | "question"
  | "condition"
  | "randomizer"
  | "delay"
  | "callFlow"
  | "aiAgent"
  | "distribute"
  | "tag"
  | "moveColumn"
  | "finish"
  | "promoEnroll"
  | "promoReceipt"
  | "promoLookup";

export type BlockTone = "sky" | "emerald" | "indigo" | "teal" | "amber" | "slate" | "violet" | "blue" | "orange" | "rose";

export interface BlockDefinition {
  key: BlockKey;
  nodeType: string;
  label: string;
  description: string;
  category: "Conversa" | "Lógica" | "IA" | "Atendimento" | "Dados" | "Promoção";
  tone: BlockTone;
  defaultData: Record<string, unknown>;
}

export const BLOCKS: BlockDefinition[] = [
  { key: "start", nodeType: "ATTENDANCE_START", label: "Bloco inicial", description: "O fluxo começa aqui", category: "Conversa", tone: "sky", defaultData: { mode: "DEFAULT", keywords: [], matchMode: "CONTAINS" } },
  {
    key: "message",
    nodeType: "SEND_MESSAGE",
    label: "Enviar mensagem",
    description: "Texto, imagem ou arquivo, com botões que levam cada um para um caminho",
    category: "Conversa",
    tone: "emerald",
    defaultData: { action: { payload: { type: "TEXT", message: "" } } },
  },
  { key: "question", nodeType: "ASK_QUESTION", label: "Pergunta", description: "Pergunta e grava a resposta no lead", category: "Conversa", tone: "indigo", defaultData: { question: "", answerType: "TEXT", maxAttempts: 3 } },
  {
    key: "condition",
    nodeType: "IF_CONDITION",
    label: "Condição",
    description: "Segue por um caminho se o contato corresponde às regras, e por outro se não",
    category: "Lógica",
    tone: "indigo",
    defaultData: { match: "ALL", rules: [] },
  },
  {
    key: "randomizer",
    nodeType: "RANDOMIZER",
    label: "Randomizador",
    description: "Sorteia um caminho pela porcentagem",
    category: "Lógica",
    tone: "teal",
    defaultData: { paths: [{ id: "a", label: "A", percent: 50 }, { id: "b", label: "B", percent: 50 }] },
  },
  { key: "delay", nodeType: "WAIT", label: "Atraso", description: "Espera um tempo antes do próximo bloco", category: "Lógica", tone: "amber", defaultData: { action: { type: "minutes", minutes: 5 } } },
  { key: "callFlow", nodeType: "CALL_WORKFLOW", label: "Conexão de fluxo", description: "Continua em outro fluxo", category: "Lógica", tone: "slate", defaultData: { workflowId: "" } },
  { key: "aiAgent", nodeType: "AI_AGENT", label: "Agente de IA", description: "A IA conversa nesta etapa e devolve o lead por uma saída", category: "IA", tone: "violet", defaultData: { instructions: "", goal: "", maxReplies: 20, intents: [], fields: [] } },
  { key: "distribute", nodeType: "DISTRIBUTE", label: "Distribuição", description: "Escolhe o atendente pelo rodízio", category: "Atendimento", tone: "blue", defaultData: {} },
  { key: "finish", nodeType: "FINISH_ATTENDANCE", label: "Finalizar", description: "Encerra o fluxo do lead", category: "Atendimento", tone: "rose", defaultData: { endFlow: true, columns: {} } },
  { key: "tag", nodeType: "TAG", label: "Etiqueta", description: "Adiciona ou tira etiquetas do lead", category: "Dados", tone: "orange", defaultData: { action: { type: "ADD", tagsIds: [] } } },
  { key: "moveColumn", nodeType: "FINISH_ATTENDANCE", label: "Mover coluna", description: "Move o lead de coluna e segue o fluxo", category: "Dados", tone: "orange", defaultData: { endFlow: false, columns: {} } },
  // Promoção STAR FRIENDS (spec 0140): as regras da campanha ficam no código da spec 0102; o fluxo decide o caminho.
  { key: "promoEnroll", nodeType: "PROMO_ENROLL", label: "Inscrever na promoção", description: "Mostra as regras, registra o aceite e inscreve o cliente", category: "Promoção", tone: "amber", defaultData: { nameSource: "ASK", nameVariable: "" } },
  { key: "promoReceipt", nodeType: "PROMO_RECEIPT", label: "Registrar cupom", description: "A IA lê o cupom e a promoção decide se vale e quantos números rende", category: "Promoção", tone: "amber", defaultData: { photoVariable: "", sendDefaultReply: true } },
  { key: "promoLookup", nodeType: "PROMO_LOOKUP", label: "Consultar promoção", description: "Grava pontos, números da sorte e saldo em variáveis", category: "Promoção", tone: "amber", defaultData: { askPhone: true } },
];

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

/** Qual bloco do catálogo um nó salvo representa (o mesmo NodeType pode ser dois blocos). */
export function blockOf(nodeType: string, data: unknown): BlockDefinition | null {
  if (nodeType === "SEND_MESSAGE") {
    const payload = asFields(asFields(asFields(data).action).payload);
    return BLOCKS.find((block) => block.key === "message") ?? null;
  }
  if (nodeType === "FINISH_ATTENDANCE") {
    return BLOCKS.find((block) => block.key === (asFields(data).endFlow === false ? "moveColumn" : "finish")) ?? null;
  }
  return BLOCKS.find((block) => block.nodeType === nodeType) ?? null;
}

export interface BlockOutput {
  /** Id do conector no editor: a saída principal usa `source-1`, como no editor das automações. */
  handleId: string;
  label: string;
  /** Botão da mensagem: o cartão desenha como botão, com a saída dele ao lado. */
  isButton?: boolean;
}

const MAIN_HANDLE = "source-1";
const NEXT_STEP_LABEL = "Próximo passo";

export interface MessageButton {
  id: string;
  text: string;
}

/** Botões de uma mensagem com menu. Vazio = mensagem comum, com saída única. */
export function messageButtonsOf(data: unknown): MessageButton[] {
  const payload = asFields(asFields(asFields(data).action).payload);
  if (payload.type !== "BUTTONS" || payload.mode === "preset") return [];
  const buttons = Array.isArray(payload.buttons) ? (payload.buttons as unknown[]) : [];
  return buttons
    .map((button) => asFields(button))
    .filter((button) => typeof button.id === "string" && button.id)
    .map((button) => ({ id: String(button.id), text: typeof button.text === "string" ? button.text : "" }));
}

/**
 * Saídas de cada bloco. Na mensagem com botões, uma por botão, "Próximo passo" para quando o cliente digita outra coisa e,
 * se houver prazo, "Sem resposta" — no FlowAstro isso vale sempre, sem o interruptor da spec 0090.
 */
export function blockOutputs(nodeType: string, data: unknown): BlockOutput[] {
  if (nodeType === "SEND_MESSAGE") {
    const buttons = messageButtonsOf(data);
    if (buttons.length === 0) return [{ handleId: MAIN_HANDLE, label: NEXT_STEP_LABEL }];
    const payload = asFields(asFields(asFields(data).action).payload);
    return [
      ...buttons.map((button) => ({ handleId: buttonOutputId(button.id), label: button.text || "Botão sem nome", isButton: true })),
      { handleId: NO_CLICK_OUTPUT, label: NEXT_STEP_LABEL },
      ...(resolveReplyDeadline(payload.replyTimeoutMinutes).hasDeadline ? [{ handleId: NO_REPLY_OUTPUT, label: "Sem resposta" }] : []),
    ];
  }
  if (nodeType === "IF_CONDITION") {
    const labels = conditionOutputLabels(parseCondition(data).match);
    return [
      { handleId: CONDITION_OUTPUTS.matches, label: labels.matches },
      { handleId: CONDITION_OUTPUTS.notMatches, label: labels.notMatches },
    ];
  }
  const outputs = attendanceNodeOutputs(nodeType, data) ?? [{ id: "main", label: NEXT_STEP_LABEL }];
  return outputs.map((output) => ({ handleId: output.id === "main" ? MAIN_HANDLE : output.id, label: output.label }));
}
