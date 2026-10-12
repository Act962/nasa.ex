// Passos que conversam com o cliente e esperam a resposta dele (spec 0099): "Pedir aceite" e
// "Preencher formulário pela conversa". São variações do quadro Enviar Mensagem, sem tipo novo de
// quadro. Sem `server-only`: o editor desenha as saídas com as mesmas regras que o servidor segue.

/** Interruptor da fase: desligado, os dois passos somem do editor e não rodam. */
export function isFormChatOn(): boolean {
  return process.env.NEXT_PUBLIC_WORKFLOW_FORM_CHAT === "true";
}

export const CONSENT_TYPE = "CONSENT";
export const FORM_CHAT_TYPE = "FORM_CHAT";

export const CONSENT_OUTPUTS = { accepted: "accepted", refused: "refused" } as const;
export const FORM_CHAT_OUTPUTS = { done: "done", gaveUp: "gave_up", human: "human" } as const;

export const DEFAULT_STEP_REPLY_TIMEOUT_MINUTES = 30;
/** Depois de 24 h sem mensagem do cliente a janela da API oficial fecha: o passo desiste em vez de escrever fora dela. */
export const MAX_STEP_REPLY_TIMEOUT_MINUTES = 1440;
export const MAX_ANSWER_ATTEMPTS = 3;
export const MAX_ANSWER_CHARS = 500;

export interface ConsentPayload {
  type: typeof CONSENT_TYPE;
  termsText: string;
  policyUrl: string;
  acceptLabel: string;
  refuseLabel: string;
  /** Quem já aceitou este mesmo texto segue direto, sem ser perguntado de novo. */
  askOnce: boolean;
  replyTimeoutMinutes: number;
}

export const DEFAULT_CONSENT_PAYLOAD: ConsentPayload = {
  type: CONSENT_TYPE,
  termsText:
    "Seguimos a Lei Geral de Proteção de Dados (LGPD). Caso peçamos dados pessoais, eles são tratados com transparência e respeito à sua privacidade. Você concorda em continuar?",
  policyUrl: "",
  acceptLabel: "Sim, concordo",
  refuseLabel: "Não",
  askOnce: true,
  replyTimeoutMinutes: DEFAULT_STEP_REPLY_TIMEOUT_MINUTES,
};

export interface FormChatPayload {
  type: typeof FORM_CHAT_TYPE;
  formId: string;
  /** Ids dos campos do formulário que serão perguntados, na ordem. */
  fieldIds: string[];
  /** Não pergunta o que o lead já tem preenchido (nome, e-mail, telefone, CPF). */
  askOnlyMissing: boolean;
  showSummary: boolean;
  /** Opção gravada quando o cliente digita algo que não está na lista de um campo, por campo. */
  fallbackOptionByField: Record<string, string>;
  replyTimeoutMinutes: number;
}

export const DEFAULT_FORM_CHAT_PAYLOAD: FormChatPayload = {
  type: FORM_CHAT_TYPE,
  formId: "",
  fieldIds: [],
  askOnlyMissing: true,
  showSummary: true,
  fallbackOptionByField: {},
  replyTimeoutMinutes: DEFAULT_STEP_REPLY_TIMEOUT_MINUTES,
};

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** O `payload` do quadro Enviar Mensagem, nos dois formatos de `data`. */
export function stepPayloadOf(data: unknown): Fields {
  const fields = asFields(data);
  const action = asFields(fields.action);
  return asFields(Object.keys(action).length > 0 ? action.payload : fields.payload);
}

export function conversationStepTypeOf(data: unknown): typeof CONSENT_TYPE | typeof FORM_CHAT_TYPE | null {
  const payloadType = String(stepPayloadOf(data).type ?? "").toUpperCase();
  return payloadType === CONSENT_TYPE || payloadType === FORM_CHAT_TYPE ? payloadType : null;
}

/** Saídas do quadro quando ele é um passo de conversa. `null` = quadro comum. */
export function conversationStepOutputs(data: unknown): { id: string; label: string }[] | null {
  if (!isFormChatOn()) return null;
  const stepType = conversationStepTypeOf(data);
  if (stepType === CONSENT_TYPE) {
    return [
      { id: CONSENT_OUTPUTS.accepted, label: "Aceitou" },
      { id: CONSENT_OUTPUTS.refused, label: "Recusou" },
    ];
  }
  if (stepType === FORM_CHAT_TYPE) {
    return [
      { id: FORM_CHAT_OUTPUTS.done, label: "Concluído" },
      { id: FORM_CHAT_OUTPUTS.gaveUp, label: "Desistiu" },
      { id: FORM_CHAT_OUTPUTS.human, label: "Pediu atendente" },
    ];
  }
  return null;
}

const REPLY_ID_PREFIX = "fs:";

/** Id do botão de resposta de um passo de conversa. Vem de volta no clique: só vale se for do próprio passo. */
export function stepReplyId(nodeId: string, key: string): string {
  return `${REPLY_ID_PREFIX}${nodeId}:${key}`;
}

export function isStepReplyId(replyId: unknown): replyId is string {
  return typeof replyId === "string" && replyId.startsWith(REPLY_ID_PREFIX);
}

/** A parte do id depois do passo, ou `null` se o clique não é deste passo. */
export function stepReplyKey(nodeId: string, replyId: unknown): string | null {
  const prefix = `${REPLY_ID_PREFIX}${nodeId}:`;
  return typeof replyId === "string" && replyId.startsWith(prefix) ? replyId.slice(prefix.length) : null;
}

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ASKS_FOR_HUMAN = /^(quero )?(falar com (um |uma |o |a )?)?(atendente|humano|pessoa)[\s!.]*$/;
const LEAVES_STEP = /^(menu|cancelar|sair|parar|voltar)[\s!.]*$/;

/**
 * Mensagem que interrompe o passo em vez de responder à pergunta. Nesses casos o passo sai sem
 * escrever nada e quem responde é o atendimento de sempre (menu ou assistente).
 */
export function interruptOf(text: string): "human" | "leave" | null {
  const normalized = normalizeAnswer(text);
  if (ASKS_FOR_HUMAN.test(normalized)) return "human";
  if (LEAVES_STEP.test(normalized)) return "leave";
  return null;
}

export const AWAITING_REPLY_KEY = "awaitingStepReply";

export interface AwaitingStepReply {
  nodeId: string;
  /** ISO. Depois disso a mensagem do cliente volta a ser do atendimento de sempre. */
  expiresAt: string;
}

/** Lê, da última mensagem enviada, se um passo de conversa está esperando a resposta do cliente. */
export function readAwaitingStepReply(metadata: unknown, now: Date): AwaitingStepReply | null {
  const stored = asFields(asFields(metadata)[AWAITING_REPLY_KEY]);
  if (typeof stored.nodeId !== "string" || typeof stored.expiresAt !== "string") return null;
  return new Date(stored.expiresAt).getTime() > now.getTime() ? { nodeId: stored.nodeId, expiresAt: stored.expiresAt } : null;
}

export function replyTimeoutMinutesOf(payload: Fields): number {
  const configured = Number(payload.replyTimeoutMinutes);
  const minutes = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STEP_REPLY_TIMEOUT_MINUTES;
  return Math.min(minutes, MAX_STEP_REPLY_TIMEOUT_MINUTES);
}
