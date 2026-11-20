import "server-only";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import prisma from "@/lib/prisma";
import type { WorkflowContext } from "@/features/workflows/lib/workflow-context";
import { isWithinTimeRange, parseCondition, parseTimeRange, VALUELESS_OPERATORS, type ConditionRule } from "../lib/conditions";

dayjs.extend(utc);
dayjs.extend(timezone);

// Avalia o bloco Condição do FlowAstro (spec 0139). Lê o lead do banco na hora: etiqueta e responsável mudam durante a
// conversa e não ficam no contexto do fluxo. Dia e hora no fuso de São Paulo, como o bloco Atraso.

const FLOW_TIMEZONE = "America/Sao_Paulo";

interface LeadSnapshot {
  tagIds: Set<string>;
  responsibleId: string | null;
  temperature: string;
  statusId: string;
  fields: Record<string, string>;
}

async function loadLeadSnapshot(leadId: string): Promise<LeadSnapshot | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      name: true,
      email: true,
      phone: true,
      document: true,
      nickname: true,
      description: true,
      addressZipCode: true,
      addressCity: true,
      addressNeighborhood: true,
      addressState: true,
      responsibleId: true,
      temperature: true,
      statusId: true,
      leadTags: { select: { tagId: true } },
    },
  });
  if (!lead) return null;
  const { leadTags, responsibleId, temperature, statusId, ...textFields } = lead;
  return {
    tagIds: new Set(leadTags.map((leadTag) => leadTag.tagId)),
    responsibleId,
    temperature,
    statusId,
    fields: Object.fromEntries(Object.entries(textFields).map(([key, value]) => [key, value ?? ""])),
  };
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function firstValue(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function compareText(actual: string, rule: ConditionRule): boolean {
  const expected = normalize(firstValue(rule.value));
  const current = normalize(actual);
  switch (rule.operator) {
    case "equals":
      return current === expected;
    case "not_equals":
      return current !== expected;
    case "contains":
      return expected !== "" && current.includes(expected);
    case "not_contains":
      return expected === "" || !current.includes(expected);
    case "is_set":
      return current !== "";
    case "is_empty":
      return current === "";
    default:
      return false;
  }
}

function evaluateRule(rule: ConditionRule, lead: LeadSnapshot | null, context: WorkflowContext, now: dayjs.Dayjs): boolean {
  const isNegated = rule.operator === "is_not" || rule.operator === "not_between";
  // Regra sem valor não decide nada: fica falsa, para o fluxo não seguir por engano.
  if (!VALUELESS_OPERATORS.has(rule.operator) && firstValue(rule.value) === "" && rule.field !== "weekday") return false;

  if (rule.field === "weekday") {
    const days = Array.isArray(rule.value) ? rule.value : [rule.value];
    if (days.length === 0) return false;
    return days.includes(String(now.day())) !== isNegated;
  }
  if (rule.field === "time") {
    const range = parseTimeRange(rule.value);
    if (!range) return false;
    return isWithinTimeRange(now.hour() * 60 + now.minute(), range) !== isNegated;
  }
  if (rule.field.startsWith("var.")) {
    const variable = (context.vars ?? {})[rule.field.slice(4)];
    return compareText(variable === undefined || variable === null ? "" : String(variable), rule);
  }
  if (!lead) return false;
  switch (rule.field) {
    case "tag":
      return lead.tagIds.has(firstValue(rule.value)) !== isNegated;
    case "responsible":
      if (rule.operator === "assigned") return lead.responsibleId !== null;
      if (rule.operator === "not_assigned") return lead.responsibleId === null;
      return (lead.responsibleId === firstValue(rule.value)) !== isNegated;
    case "temperature":
      return (lead.temperature === firstValue(rule.value)) !== isNegated;
    case "column":
      return (lead.statusId === firstValue(rule.value)) !== isNegated;
    default:
      return rule.field.startsWith("lead.") ? compareText(lead.fields[rule.field.slice(5)] ?? "", rule) : false;
  }
}

/** `true` = sai por "corresponde"; sem regras, segue por "não corresponde". */
export async function evaluateFlowAstroCondition(data: unknown, context: WorkflowContext): Promise<{ passed: boolean; results: boolean[] }> {
  const { match, rules } = parseCondition(data);
  if (rules.length === 0) return { passed: false, results: [] };
  const leadId = typeof context.lead?.id === "string" ? context.lead.id : null;
  const needsLead = rules.some((rule) => !["weekday", "time"].includes(rule.field) && !rule.field.startsWith("var."));
  const lead = needsLead && leadId ? await loadLeadSnapshot(leadId) : null;
  const now = dayjs().tz(FLOW_TIMEZONE);
  const results = rules.map((rule) => evaluateRule(rule, lead, context, now));
  return { passed: match === "ALL" ? results.every(Boolean) : results.some(Boolean), results };
}
