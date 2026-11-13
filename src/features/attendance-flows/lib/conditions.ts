// Regras do bloco Condição do FlowAstro (spec 0139), no estilo do BotConversa: "Contato corresponde a TODAS / a
// QUALQUER condição". Usa o mesmo NodeType IF_CONDITION das automações, com saídas "true"/"false"; o formato com
// `rules` é avaliado pelo FlowAstro, que lê etiquetas e responsável do banco na hora. Sem `server-only`: o editor usa.
import { LEAD_FIELD_OPTIONS, toVariableName } from "./nodes";

export type ConditionMatch = "ALL" | "ANY";

export type ConditionOperator =
  | "is"
  | "is_not"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_set"
  | "is_empty"
  | "between"
  | "not_between"
  | "assigned"
  | "not_assigned";

export interface ConditionRule {
  id: string;
  /** `tag`, `weekday`, `time`, `responsible`, `temperature`, `column`, `lead.<campo>` ou `var.<nome>`. */
  field: string;
  operator: ConditionOperator;
  /** Texto, id, lista de dias ("0" = domingo) ou faixa de hora ("08:00-18:00"), conforme o campo. */
  value: string | string[];
}

export interface ConditionData {
  match: ConditionMatch;
  rules: ConditionRule[];
}

export type FieldKind = "tag" | "weekday" | "time" | "responsible" | "temperature" | "column" | "text";

export interface ConditionFieldOption {
  field: string;
  label: string;
  kind: FieldKind;
  group: "Operações mais usadas" | "Campos do contato" | "Variáveis do fluxo";
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  is: "É",
  is_not: "Não é",
  equals: "É igual a",
  not_equals: "Não é igual a",
  contains: "Contém",
  not_contains: "Não contém",
  is_set: "Está preenchido",
  is_empty: "Está vazio",
  between: "Entre",
  not_between: "Fora de",
  assigned: "Está atribuído",
  not_assigned: "Não está atribuído",
};

export const OPERATORS_BY_KIND: Record<FieldKind, ConditionOperator[]> = {
  tag: ["is", "is_not"],
  weekday: ["is", "is_not"],
  time: ["between", "not_between"],
  responsible: ["assigned", "not_assigned", "is", "is_not"],
  temperature: ["is", "is_not"],
  column: ["is", "is_not"],
  text: ["equals", "not_equals", "contains", "not_contains", "is_set", "is_empty"],
};

/** Operadores que não pedem valor. */
export const VALUELESS_OPERATORS = new Set<ConditionOperator>(["is_set", "is_empty", "assigned", "not_assigned"]);

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const TEMPERATURE_LABELS: Record<string, string> = { COLD: "Frio", WARM: "Morno", HOT: "Quente", VERY_HOT: "Muito quente" };

export const BASE_FIELD_OPTIONS: ConditionFieldOption[] = [
  { field: "tag", label: "Etiqueta", kind: "tag", group: "Operações mais usadas" },
  { field: "weekday", label: "Dia da semana ao passar por aqui", kind: "weekday", group: "Operações mais usadas" },
  { field: "time", label: "Hora ao passar por aqui", kind: "time", group: "Operações mais usadas" },
  { field: "responsible", label: "Atendimento atribuído a um membro", kind: "responsible", group: "Operações mais usadas" },
  { field: "temperature", label: "Temperatura do lead", kind: "temperature", group: "Operações mais usadas" },
  { field: "column", label: "Coluna do funil", kind: "column", group: "Operações mais usadas" },
  { field: "lead.phone", label: "Telefone", kind: "text", group: "Campos do contato" },
  ...LEAD_FIELD_OPTIONS.map((option) => ({ field: `lead.${option.key}`, label: option.label, kind: "text" as const, group: "Campos do contato" as const })),
];

export function fieldOptionOf(field: string): ConditionFieldOption {
  const known = BASE_FIELD_OPTIONS.find((option) => option.field === field);
  if (known) return known;
  if (field.startsWith("var.")) return { field, label: `Variável ${field.slice(4)}`, kind: "text", group: "Variáveis do fluxo" };
  return { field, label: field, kind: "text", group: "Campos do contato" };
}

export function variableFieldOf(name: string): string {
  return `var.${toVariableName(name)}`;
}

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

/** `true` quando o dado é do formato do FlowAstro (com `rules`), e não do Condicional antigo das automações. */
export function isFlowAstroCondition(data: unknown): boolean {
  return Array.isArray(asFields(data).rules);
}

export function parseCondition(data: unknown): ConditionData {
  const fields = asFields(data);
  const rules = (Array.isArray(fields.rules) ? fields.rules : [])
    .map((rule) => asFields(rule))
    .filter((rule) => typeof rule.id === "string" && typeof rule.field === "string")
    .map((rule) => {
      const kind = fieldOptionOf(String(rule.field)).kind;
      const allowed = OPERATORS_BY_KIND[kind];
      const operator = allowed.includes(rule.operator as ConditionOperator) ? (rule.operator as ConditionOperator) : allowed[0];
      const value = Array.isArray(rule.value) ? rule.value.map(String) : typeof rule.value === "string" ? rule.value : "";
      return { id: String(rule.id), field: String(rule.field), operator, value };
    });
  return { match: fields.match === "ANY" ? "ANY" : "ALL", rules };
}

/** Faixa "08:00-18:00" em minutos do dia. Faixa que vira a meia-noite ("22:00-06:00") é aceita. */
export function parseTimeRange(value: string | string[]): { startMinutes: number; endMinutes: number } | null {
  const text = Array.isArray(value) ? value[0] ?? "" : value;
  const match = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);
  if (startMinutes > 24 * 60 || endMinutes > 24 * 60) return null;
  return { startMinutes, endMinutes };
}

export function isWithinTimeRange(minuteOfDay: number, range: { startMinutes: number; endMinutes: number }): boolean {
  return range.startMinutes <= range.endMinutes
    ? minuteOfDay >= range.startMinutes && minuteOfDay < range.endMinutes
    : minuteOfDay >= range.startMinutes || minuteOfDay < range.endMinutes;
}

export const CONDITION_OUTPUTS = { matches: "true", notMatches: "false" } as const;

export function conditionOutputLabels(match: ConditionMatch): { matches: string; notMatches: string } {
  return match === "ALL"
    ? { matches: "Corresponde a TODAS as condições", notMatches: "NÃO corresponde a uma ou mais" }
    : { matches: "Pelo menos UMA condição é verdadeira", notMatches: "NÃO corresponde a NENHUMA" };
}
