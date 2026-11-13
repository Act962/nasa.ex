// Blocos próprios do Fluxo de Atendimento (spec 0139, D-5): dados, saídas e validação de resposta.
// Sem `server-only`: o editor desenha as saídas com as mesmas regras do motor.
import { normalizePhone } from "@/utils/format-phone";
import { parseBlockCapabilities, type BlockAiCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

// ─── Campos do lead que um bloco pode preencher ──────────────

export const LEAD_FIELD_OPTIONS = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "document", label: "CPF/CNPJ" },
  { key: "nickname", label: "Apelido" },
  { key: "description", label: "Descrição" },
  { key: "addressZipCode", label: "CEP" },
  { key: "addressCity", label: "Cidade" },
  { key: "addressNeighborhood", label: "Bairro" },
  { key: "addressState", label: "Estado" },
] as const;
export type LeadFieldKey = (typeof LEAD_FIELD_OPTIONS)[number]["key"];

export function isLeadFieldKey(value: unknown): value is LeadFieldKey {
  return LEAD_FIELD_OPTIONS.some((option) => option.key === value);
}

/** Nome de variável do fluxo: vira `{{vars.<nome>}}` nos blocos seguintes. */
export function toVariableName(value: unknown): string {
  return asText(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ─── Pergunta ────────────────────────────────────────────────

export const ANSWER_TYPES = ["TEXT", "NUMBER", "EMAIL", "PHONE", "DATE", "DOCUMENT", "FILE"] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];
export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  TEXT: "Texto livre",
  NUMBER: "Número",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  DATE: "Data (dd/mm/aaaa)",
  DOCUMENT: "CPF ou CNPJ",
  FILE: "Foto ou arquivo",
};

export const ASK_QUESTION_OUTPUTS = { answered: "answered", invalid: "invalid", noReply: "no_reply" } as const;

// ─── Prazo para responder (spec 0139, D-13) ──────────────────

/**
 * Teto técnico de "sem prazo". A espera por resposta é um estado, não um relógio: o fluxo fica parado até o cliente
 * responder. Mas o Inngest limita a duração da execução inteira, esperas incluídas (Free 30 dias, Pro 90, Business 366).
 * Usamos o menor, para valer em qualquer plano; vencido, o fluxo do lead termina sem enviar nada.
 */
export const ATTENDANCE_MAX_WAIT_MINUTES = 30 * 1440;
/** Saída de quando o prazo escolhido pelo usuário vence sem resposta. Só existe com prazo. */
export const NO_REPLY_OUTPUT = "no_reply";

export interface ReplyDeadline {
  hasDeadline: boolean;
  timeoutMinutes: number;
}

/** Prazo configurado no bloco. Vazio ou zero = sem prazo (padrão). */
export function resolveReplyDeadline(value: unknown): ReplyDeadline {
  const minutes = Math.round(Number(value));
  return Number.isFinite(minutes) && minutes > 0
    ? { hasDeadline: true, timeoutMinutes: Math.min(minutes, ATTENDANCE_MAX_WAIT_MINUTES) }
    : { hasDeadline: false, timeoutMinutes: ATTENDANCE_MAX_WAIT_MINUTES };
}

export interface AskQuestionData {
  question: string;
  answerType: AnswerType;
  saveToField: LeadFieldKey | null;
  variableName: string;
  maxAttempts: number;
  invalidMessage: string;
  replyDeadline: ReplyDeadline;
}

export function parseAskQuestion(data: unknown): AskQuestionData {
  const fields = asFields(data);
  return {
    question: asText(fields.question).trim(),
    answerType: ANSWER_TYPES.includes(fields.answerType as AnswerType) ? (fields.answerType as AnswerType) : "TEXT",
    saveToField: isLeadFieldKey(fields.saveToField) ? fields.saveToField : null,
    variableName: toVariableName(fields.variableName),
    maxAttempts: clampInteger(fields.maxAttempts, 3, 1, 5),
    invalidMessage: asText(fields.invalidMessage).trim() || "Não entendi. Pode responder de novo?",
    replyDeadline: resolveReplyDeadline(fields.replyTimeoutMinutes),
  };
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, "");
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++) sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const checkDigit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

/** Confere a resposta pelo tipo pedido. `null` = inválida; senão, o valor já no formato de gravar. */
export function validateAnswer(answerType: AnswerType, rawText: string): string | null {
  const text = rawText.trim();
  if (!text) return null;
  switch (answerType) {
    case "TEXT":
      return text.slice(0, 500);
    case "NUMBER": {
      const normalized = text.replace(/\./g, "").replace(",", ".");
      return /^-?\d+(\.\d+)?$/.test(normalized) ? normalized : null;
    }
    case "EMAIL":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text) ? text.toLowerCase() : null;
    case "PHONE": {
      const phone = normalizePhone(text);
      return phone && onlyDigits(phone).length >= 10 ? phone : null;
    }
    case "DATE": {
      const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
      if (!match) return null;
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
      return isRealDate ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}` : null;
    }
    case "DOCUMENT": {
      const digits = onlyDigits(text);
      return isValidCpf(digits) || isValidCnpj(digits) ? digits : null;
    }
    // Foto ou arquivo é conferido pela mensagem (`isPhotoOrPdf`), nunca pelo texto (spec 0140, RF-1).
    case "FILE":
      return null;
  }
}

/** Foto ou PDF; figurinha (webp) não vale. Mesma regra do cupom da campanha (spec 0102). */
export function isPhotoOrPdf(mimetype: string | null | undefined): boolean {
  const type = mimetype ?? "";
  if (type.includes("webp")) return false;
  return type.startsWith("image/") || type.includes("pdf");
}

// ─── Randomizador ────────────────────────────────────────────

export const RANDOMIZER_OUTPUT_PREFIX = "path:";

export interface RandomizerPath {
  id: string;
  label: string;
  percent: number;
}

export function parseRandomizerPaths(data: unknown): RandomizerPath[] {
  const paths = Array.isArray(asFields(data).paths) ? (asFields(data).paths as unknown[]) : [];
  return paths
    .map((path) => asFields(path))
    .filter((path) => asText(path.id))
    .slice(0, 5)
    .map((path) => ({ id: asText(path.id), label: asText(path.label) || "Caminho", percent: clampInteger(path.percent, 0, 0, 100) }));
}

/** `roll` entre 0 e 1. Porcentagens que não somam 100 são tratadas como peso. */
export function pickRandomizerPath(paths: RandomizerPath[], roll: number): RandomizerPath | null {
  const total = paths.reduce((sum, path) => sum + path.percent, 0);
  if (total <= 0) return null;
  let threshold = roll * total;
  for (const path of paths) {
    threshold -= path.percent;
    if (threshold < 0) return path;
  }
  return paths[paths.length - 1] ?? null;
}

// ─── Distribuição e Finalizar ───────────────────────────────

export const DISTRIBUTE_OUTPUTS = { assigned: "main", noAttendant: "no_attendant" } as const;

/**
 * Finalizar e Mover coluna usam o mesmo bloco: `endFlow` diz se o fluxo do lead termina. Cada número tem as próprias
 * colunas, então a coluna é escolhida por número (spec 0139, D-11); número sem coluna escolhida não move.
 */
export interface ColumnMoveData {
  endFlow: boolean;
  columns: Record<string, string>;
}

export function parseColumnMove(data: unknown): ColumnMoveData {
  const fields = asFields(data);
  const rawColumns = asFields(fields.columns);
  const columns: Record<string, string> = {};
  for (const [trackingId, statusId] of Object.entries(rawColumns)) {
    if (typeof statusId === "string" && statusId) columns[trackingId] = statusId;
  }
  return { endFlow: fields.endFlow !== false, columns };
}

// ─── Agente de IA ────────────────────────────────────────────

export const AI_AGENT_OUTPUTS = {
  objectiveDone: "objective_done",
  wantsHuman: "wants_human",
  maxReplies: "max_replies",
  noReply: "no_reply",
  error: "error",
} as const;
export const AI_AGENT_INTENT_PREFIX = "intent:";
export const AI_AGENT_DEFAULT_MAX_REPLIES = 20;

export interface AiAgentIntent {
  id: string;
  label: string;
  description: string;
}

export interface AiAgentField {
  /** Campo do lead ou, sem campo, só variável do fluxo. */
  leadField: LeadFieldKey | null;
  variableName: string;
  description: string;
}

/** Assistente configurado no próprio bloco (spec 0139, D-14). Ausente = usa a IA do funil do número, como antes. */
export interface AiAgentAssistant {
  assistantName: string;
  prompt: string;
  capabilities: BlockAiCapabilities;
}

export function parseAiAgentAssistant(raw: unknown): AiAgentAssistant | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const fields = asFields(raw);
  return {
    assistantName: asText(fields.assistantName).trim(),
    prompt: asText(fields.prompt).trim(),
    capabilities: parseBlockCapabilities(fields.capabilities),
  };
}

export interface AiAgentData {
  assistant: AiAgentAssistant | null;
  instructions: string;
  goal: string;
  maxReplies: number;
  replyDeadline: ReplyDeadline;
  intents: AiAgentIntent[];
  fields: AiAgentField[];
}

export function parseAiAgent(data: unknown): AiAgentData {
  const fields = asFields(data);
  const intents = (Array.isArray(fields.intents) ? (fields.intents as unknown[]) : [])
    .map((intent) => asFields(intent))
    .filter((intent) => asText(intent.id) && asText(intent.label).trim())
    .slice(0, 5)
    .map((intent) => ({ id: asText(intent.id), label: asText(intent.label).trim(), description: asText(intent.description).trim() }));
  const capturedFields = (Array.isArray(fields.fields) ? (fields.fields as unknown[]) : [])
    .map((field) => asFields(field))
    .map((field) => {
      const leadField = isLeadFieldKey(field.leadField) ? field.leadField : null;
      return { leadField, variableName: toVariableName(field.variableName) || leadField || "", description: asText(field.description).trim() };
    })
    .filter((field) => field.variableName)
    .slice(0, 10);
  return {
    assistant: parseAiAgentAssistant(fields.assistant),
    instructions: asText(fields.instructions).trim(),
    goal: asText(fields.goal).trim(),
    maxReplies: clampInteger(fields.maxReplies, AI_AGENT_DEFAULT_MAX_REPLIES, 1, 50),
    replyDeadline: resolveReplyDeadline(fields.replyTimeoutMinutes),
    intents,
    fields: capturedFields,
  };
}

// ─── Promoção STAR FRIENDS (spec 0140) ───────────────────────

export const PROMO_ENROLL_OUTPUTS = {
  enrolled: "enrolled",
  alreadyEnrolled: "already_enrolled",
  refused: "refused",
  closed: "closed",
  other: "other",
  noReply: "no_reply",
} as const;

export const PROMO_RECEIPT_OUTPUTS = {
  accepted: "accepted",
  duplicate: "duplicate",
  notValid: "not_valid",
  unreadable: "unreadable",
  inReview: "in_review",
  dailyLimit: "daily_limit",
  notEnrolled: "not_enrolled",
  closed: "closed",
  tryLater: "try_later",
} as const;

export const PROMO_LOOKUP_OUTPUTS = {
  done: "done",
  notEnrolled: "not_enrolled",
  phoneMismatch: "phone_mismatch",
  other: "other",
  noReply: "no_reply",
} as const;

/** Variáveis que os blocos da promoção gravam; o editor oferece cada uma no seletor de variáveis. */
export const PROMO_RECEIPT_VARIABLES = ["numeros_da_sorte", "qtd_numeros", "valor_cupom", "saldo_proximo_numero"] as const;
export const PROMO_LOOKUP_VARIABLES = ["qtd_cupons", "total_compras", "qtd_numeros", "saldo_proximo_numero", "numeros_da_sorte", "stars"] as const;

/** De onde vem o nome da inscrição: perguntar (como a campanha de sempre), o nome do contato ou uma variável do fluxo. */
export type PromoNameSource = "ASK" | "CONTACT" | "VARIABLE";

export interface PromoEnrollData {
  nameSource: PromoNameSource;
  nameVariable: string;
  replyDeadline: ReplyDeadline;
}

export function parsePromoEnroll(data: unknown): PromoEnrollData {
  const fields = asFields(data);
  const nameVariable = toVariableName(fields.nameVariable);
  const nameSource: PromoNameSource = fields.nameSource === "CONTACT" ? "CONTACT" : fields.nameSource === "VARIABLE" && nameVariable ? "VARIABLE" : "ASK";
  return { nameSource, nameVariable, replyDeadline: resolveReplyDeadline(fields.replyTimeoutMinutes) };
}

export interface PromoReceiptData {
  /** Variável com a foto (da Pergunta "Foto ou arquivo"); vazia = última foto que o cliente mandou. */
  photoVariable: string;
  sendDefaultReply: boolean;
}

export function parsePromoReceipt(data: unknown): PromoReceiptData {
  const fields = asFields(data);
  return { photoVariable: toVariableName(fields.photoVariable), sendDefaultReply: fields.sendDefaultReply !== false };
}

export interface PromoLookupData {
  askPhone: boolean;
  replyDeadline: ReplyDeadline;
}

export function parsePromoLookup(data: unknown): PromoLookupData {
  const fields = asFields(data);
  return { askPhone: fields.askPhone !== false, replyDeadline: resolveReplyDeadline(fields.replyTimeoutMinutes) };
}

/** Saídas de cada bloco do atendimento, para o editor e para o motor. `null` = não é bloco do atendimento. */
export function attendanceNodeOutputs(nodeType: string, data: unknown): { id: string; label: string }[] | null {
  switch (nodeType) {
    case "ATTENDANCE_START":
      return [{ id: "main", label: "Começar" }];
    case "ASK_QUESTION":
      return [
        { id: ASK_QUESTION_OUTPUTS.answered, label: "Respondeu" },
        { id: ASK_QUESTION_OUTPUTS.invalid, label: "Resposta inválida" },
        ...(parseAskQuestion(data).replyDeadline.hasDeadline ? [{ id: ASK_QUESTION_OUTPUTS.noReply, label: "Sem resposta" }] : []),
      ];
    case "RANDOMIZER": {
      const paths = parseRandomizerPaths(data);
      return paths.length > 0 ? paths.map((path) => ({ id: `${RANDOMIZER_OUTPUT_PREFIX}${path.id}`, label: `${path.label} (${path.percent}%)` })) : [{ id: "main", label: "Seguir" }];
    }
    case "DISTRIBUTE":
      return [
        { id: DISTRIBUTE_OUTPUTS.assigned, label: "Atendente escolhido" },
        { id: DISTRIBUTE_OUTPUTS.noAttendant, label: "Sem atendente" },
      ];
    case "FINISH_ATTENDANCE":
      return parseColumnMove(data).endFlow ? [] : [{ id: "main", label: "Seguir" }];
    case "AI_AGENT":
      return [
        ...parseAiAgent(data).intents.map((intent) => ({ id: `${AI_AGENT_INTENT_PREFIX}${intent.id}`, label: intent.label })),
        { id: AI_AGENT_OUTPUTS.objectiveDone, label: "Objetivo cumprido" },
        { id: AI_AGENT_OUTPUTS.wantsHuman, label: "Pediu atendente" },
        { id: AI_AGENT_OUTPUTS.maxReplies, label: "Limite de mensagens" },
        ...(parseAiAgent(data).replyDeadline.hasDeadline ? [{ id: AI_AGENT_OUTPUTS.noReply, label: "Sem resposta" }] : []),
        { id: AI_AGENT_OUTPUTS.error, label: "Erro" },
      ];
    case "PROMO_ENROLL":
      return [
        { id: PROMO_ENROLL_OUTPUTS.enrolled, label: "Inscrito" },
        { id: PROMO_ENROLL_OUTPUTS.alreadyEnrolled, label: "Já inscrito" },
        { id: PROMO_ENROLL_OUTPUTS.refused, label: "Recusou" },
        { id: PROMO_ENROLL_OUTPUTS.closed, label: "Promoção fechada" },
        { id: PROMO_ENROLL_OUTPUTS.other, label: "Outro assunto" },
        ...(parsePromoEnroll(data).replyDeadline.hasDeadline ? [{ id: PROMO_ENROLL_OUTPUTS.noReply, label: "Sem resposta" }] : []),
      ];
    case "PROMO_RECEIPT":
      return [
        { id: PROMO_RECEIPT_OUTPUTS.accepted, label: "Aceito" },
        { id: PROMO_RECEIPT_OUTPUTS.duplicate, label: "Repetido" },
        { id: PROMO_RECEIPT_OUTPUTS.notValid, label: "Não vale" },
        { id: PROMO_RECEIPT_OUTPUTS.unreadable, label: "Ilegível" },
        { id: PROMO_RECEIPT_OUTPUTS.inReview, label: "Em conferência" },
        { id: PROMO_RECEIPT_OUTPUTS.dailyLimit, label: "Limite do dia" },
        { id: PROMO_RECEIPT_OUTPUTS.notEnrolled, label: "Não inscrito" },
        { id: PROMO_RECEIPT_OUTPUTS.closed, label: "Promoção fechada" },
        { id: PROMO_RECEIPT_OUTPUTS.tryLater, label: "Tente mais tarde" },
      ];
    case "PROMO_LOOKUP": {
      const lookup = parsePromoLookup(data);
      return [
        { id: PROMO_LOOKUP_OUTPUTS.done, label: "Pronto" },
        { id: PROMO_LOOKUP_OUTPUTS.notEnrolled, label: "Não inscrito" },
        ...(lookup.askPhone
          ? [
              { id: PROMO_LOOKUP_OUTPUTS.phoneMismatch, label: "Celular não confere" },
              { id: PROMO_LOOKUP_OUTPUTS.other, label: "Outro assunto" },
              ...(lookup.replyDeadline.hasDeadline ? [{ id: PROMO_LOOKUP_OUTPUTS.noReply, label: "Sem resposta" }] : []),
            ]
          : []),
      ];
    }
    default:
      return null;
  }
}
