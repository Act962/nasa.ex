import { filterInlineOptions, buildOrbitLookupValue } from "@/features/form-records/lib/orbit-lookup-value";
import { flattenBlocks } from "@/features/form-records/lib/response-values";
import { applyMask, isValidByFormat, type MaskedFormat } from "@/features/form/lib/masks";
import { MAX_ANSWER_CHARS, normalizeAnswer } from "./conversation-steps";

// Um formulário do Órbita Forms perguntado pela conversa (spec 0099, parte A): quais campos dá para
// perguntar, como cada pergunta sai e como a resposta do cliente vira o valor que o formulário grava.
// Puro e sem `server-only`: a janela de configuração lista os campos com a mesma função.

export type ChatFieldKind = "text" | "masked" | "choice" | "lookup" | "date" | "number";

export interface FieldValue {
  value: string;
  meta?: Record<string, unknown>;
}

export interface ChatFieldOption {
  /** Vai no id do botão e volta no clique. */
  key: string;
  label: string;
  value: FieldValue;
}

export interface ChatField {
  id: string;
  label: string;
  kind: ChatFieldKind;
  isRequired: boolean;
  format?: MaskedFormat;
  /** Opções fechadas: viram botões (até 3) ou lista (até 10). */
  options?: ChatFieldOption[];
  /** Lista longa do próprio campo: o cliente digita e a resposta é procurada nela. */
  inlineOptions?: string[];
  /** Campo que espelha um dado do lead: pode ser pulado quando o lead já tem. */
  leadSource?: "name" | "email" | "phone" | "document" | "address";
  minimum?: number;
  maximum?: number;
}

type Attributes = Record<string, unknown>;

const MAX_CHOICE_OPTIONS = 10;
const OPTION_TITLE_MAX_CHARS = 24;

function clipTitle(label: string): string {
  return label.length > OPTION_TITLE_MAX_CHARS ? `${label.slice(0, OPTION_TITLE_MAX_CHARS - 1).trim()}…` : label;
}

function leadSourceOf(attributes: Attributes, format: MaskedFormat | undefined): ChatField["leadSource"] {
  const prefill = attributes.prefillFromLead;
  if (prefill === "name" || prefill === "email" || prefill === "phone" || prefill === "address") return prefill;
  // Spec 0104: campo de endereço aproveita o endereço de entrega do pedido do catálogo.
  if (!format && /endere[cç]o/i.test(String(attributes.label ?? ""))) return "address";
  if (format === "cpf") return "document";
  if (format === "email") return "email";
  if (format === "phone-br") return "phone";
  return undefined;
}

function toChatField(block: { id: string; blockType: string; attributes?: Attributes }): ChatField | null {
  const attributes = block.attributes ?? {};
  const base = { id: block.id, label: String(attributes.label ?? "").trim() || "Campo sem nome", isRequired: attributes.required === true };
  switch (block.blockType) {
    case "TextField":
    case "TextArea":
    case "Url":
      return { ...base, kind: "text", leadSource: leadSourceOf(attributes, undefined) };
    case "MaskedField": {
      const format = attributes.format as MaskedFormat | undefined;
      if (!format) return { ...base, kind: "text" };
      return { ...base, kind: "masked", format, leadSource: leadSourceOf(attributes, format) };
    }
    case "RadioSelect": {
      if (attributes.allowMultiple === true) return null;
      const rawOptions = Array.isArray(attributes.options) ? (attributes.options as { value?: unknown; tagId?: unknown }[]) : [];
      const options = rawOptions
        .filter((option) => typeof option.value === "string" && option.value)
        .map((option, optionIndex) => ({
          key: String(optionIndex),
          label: String(option.value),
          value: { value: String(option.value), meta: { tagId: typeof option.tagId === "string" ? option.tagId : null } },
        }));
      return options.length > 0 && options.length <= MAX_CHOICE_OPTIONS ? { ...base, kind: "choice", options } : null;
    }
    case "Dropdown": {
      const rawOptions = Array.isArray(attributes.options) ? (attributes.options as { id?: unknown; label?: unknown }[]) : [];
      const options = rawOptions
        .filter((option) => typeof option.label === "string" && option.label)
        .map((option, optionIndex) => ({ key: String(optionIndex), label: String(option.label), value: { value: String(option.label), meta: { id: option.id } } }));
      if (options.length === 0) return null;
      // Lista comprida demais para o WhatsApp: o cliente digita e a resposta é procurada nas opções.
      return options.length <= MAX_CHOICE_OPTIONS ? { ...base, kind: "choice", options } : { ...base, kind: "lookup", options, inlineOptions: options.map((option) => option.label) };
    }
    case "OrbitLookup": {
      if (attributes.source !== "INLINE") return null;
      const inlineOptions = Array.isArray(attributes.inlineOptions) ? (attributes.inlineOptions as unknown[]).map(String).filter(Boolean) : [];
      return inlineOptions.length > 0 ? { ...base, kind: "lookup", inlineOptions } : null;
    }
    case "DatePicker":
      return attributes.withTime === true ? null : { ...base, kind: "date" };
    case "StarRating":
      return { ...base, kind: "number", minimum: 1, maximum: Number(attributes.maxStars) || 5 };
    case "Slider":
      return { ...base, kind: "number", minimum: Number(attributes.min) || 0, maximum: Number(attributes.max) || 100 };
    default:
      return null;
  }
}

/** Os campos do formulário que dá para perguntar pela conversa, na ordem em que aparecem nele. */
export function listChatFields(jsonBlock: unknown): ChatField[] {
  return flattenBlocks(jsonBlock).flatMap((block) => {
    const field = toChatField(block as { id: string; blockType: string; attributes?: Attributes });
    return field ? [field] : [];
  });
}

const FORMAT_HINT: Record<MaskedFormat, string> = {
  cpf: "só os 11 números",
  "phone-br": "com DDD",
  cep: "8 números",
  email: "exemplo: nome@email.com",
  "city-uf": "exemplo: Teresina - PI",
};

export const SKIP_WORD = "pular";

/** A pergunta de um campo, como chega ao cliente. */
export function questionFor(field: ChatField): string {
  const label = field.label.replace(/[:?\s]+$/, "");
  const hint =
    field.kind === "masked" && field.format
      ? ` (${FORMAT_HINT[field.format]})`
      : field.kind === "date"
        ? " (dd/mm/aaaa)"
        : field.kind === "number"
          ? ` (de ${field.minimum} a ${field.maximum})`
          : "";
  const skipHint = field.isRequired || field.kind === "choice" ? "" : `\nSe preferir não informar, responda "${SKIP_WORD}".`;
  return `${label}?${hint}${skipHint}`;
}

/** Botões de um campo de opções; `null` quando a resposta é digitada. */
export function optionButtonsFor(field: ChatField): { key: string; title: string }[] | null {
  if (field.kind !== "choice" || !field.options) return null;
  return field.options.map((option) => ({ key: option.key, title: clipTitle(option.label) }));
}

export type AnswerResult =
  | { isValid: true; value: FieldValue; display: string }
  | { isValid: false; reason: "invalid" | "not_in_list"; message: string };

const INVALID_MESSAGE: Record<ChatFieldKind, string> = {
  text: "Não entendi a resposta. Pode escrever de novo?",
  masked: "Esse dado não parece válido.",
  choice: "Escolha uma das opções, por favor.",
  lookup: "Não encontrei na nossa lista.",
  date: "Não entendi a data. Envie no formato dd/mm/aaaa, por exemplo 15/12/1987.",
  number: "Envie só o número, por favor.",
};

const MASKED_INVALID_MESSAGE: Record<MaskedFormat, string> = {
  cpf: "Esse CPF não é válido. Envie os 11 números, sem pontos nem traço.",
  "phone-br": "Esse telefone não é válido. Envie com o DDD, só os números.",
  cep: "Esse CEP não é válido. Envie os 8 números.",
  email: "Esse e-mail não é válido. Confira e envie de novo.",
  "city-uf": "Envie a cidade e o estado, por exemplo: Teresina - PI.",
};

const DATE_PATTERN = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/;
const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2100;

function parseDate(text: string): { iso: string; display: string } | null {
  const match = text.trim().match(DATE_PATTERN);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate || year < EARLIEST_YEAR || year > LATEST_YEAR) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return { iso: `${year}-${pad(month)}-${pad(day)}`, display: `${pad(day)}/${pad(month)}/${year}` };
}

/**
 * Lê a resposta do cliente para um campo. `optionKey` vem do clique num botão do próprio passo; sem
 * clique, vale o texto digitado (inclusive o número ou o nome de uma opção).
 */
export function readAnswer(field: ChatField, answer: { text: string; optionKey: string | null }): AnswerResult {
  const text = answer.text.trim().slice(0, MAX_ANSWER_CHARS);
  const normalized = normalizeAnswer(text);
  if (!field.isRequired && field.kind !== "choice" && normalized === SKIP_WORD) return { isValid: true, value: { value: "" }, display: "não informado" };

  switch (field.kind) {
    case "choice": {
      const options = field.options ?? [];
      const chosen =
        options.find((option) => option.key === answer.optionKey) ??
        options.find((option) => normalizeAnswer(option.label) === normalized) ??
        (/^\d{1,2}$/.test(normalized) ? options[Number(normalized) - 1] : undefined);
      return chosen ? { isValid: true, value: chosen.value, display: chosen.label } : { isValid: false, reason: "invalid", message: INVALID_MESSAGE.choice };
    }
    case "lookup": {
      const inlineOptions = field.inlineOptions ?? [];
      const exact = inlineOptions.find((option) => normalizeAnswer(option) === normalized);
      const candidates = exact ? [exact] : text ? filterInlineOptions(inlineOptions, text, 2) : [];
      if (candidates.length !== 1) return { isValid: false, reason: "not_in_list", message: INVALID_MESSAGE.lookup };
      return { isValid: true, value: lookupValueOf(field, candidates[0]), display: candidates[0] };
    }
    case "masked": {
      const format = field.format!;
      const masked = applyMask(format, text);
      if (!isValidByFormat(format, masked)) return { isValid: false, reason: "invalid", message: MASKED_INVALID_MESSAGE[format] };
      return { isValid: true, value: { value: masked, meta: { format, raw: masked.replace(/\D/g, ""), isValid: true } }, display: masked };
    }
    case "date": {
      const parsed = parseDate(text);
      return parsed ? { isValid: true, value: { value: parsed.iso, meta: { iso: parsed.iso } }, display: parsed.display } : { isValid: false, reason: "invalid", message: INVALID_MESSAGE.date };
    }
    case "number": {
      const amount = Number(normalized.replace(",", "."));
      const isInRange = Number.isFinite(amount) && amount >= (field.minimum ?? -Infinity) && amount <= (field.maximum ?? Infinity);
      return normalized && isInRange ? { isValid: true, value: { value: String(amount) }, display: String(amount) } : { isValid: false, reason: "invalid", message: INVALID_MESSAGE.number };
    }
    default:
      return text ? { isValid: true, value: { value: text }, display: text } : { isValid: false, reason: "invalid", message: INVALID_MESSAGE.text };
  }
}

/** O valor gravado para um item de lista longa, no formato do tipo de campo de origem. */
export function lookupValueOf(field: ChatField, optionLabel: string): FieldValue {
  const dropdownOption = field.options?.find((option) => option.label === optionLabel);
  return dropdownOption ? dropdownOption.value : buildOrbitLookupValue({ text: optionLabel, source: "INLINE", refId: null });
}

/** O que mostrar no resumo para um valor já gravado. */
export function displayOf(field: ChatField, stored: FieldValue | undefined): string {
  if (!stored || !stored.value) return "não informado";
  if (field.kind === "date") {
    const [year, month, day] = stored.value.slice(0, 10).split("-");
    return year && month && day ? `${day}/${month}/${year}` : stored.value;
  }
  return stored.value;
}

export function summaryOf(fields: ChatField[], answers: Record<string, FieldValue | undefined>): string {
  return ["Confira os seus dados:", ...fields.map((field) => `${field.label.replace(/[:?\s]+$/, "")}: ${displayOf(field, answers[field.id])}`), "", "Está correto?"].join("\n");
}
