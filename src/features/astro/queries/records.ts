import "server-only";
import prisma from "@/lib/prisma";
import { money, periodFrom, plural, startOfMonth, startOfToday, type AstroQuery, type AstroQueryResult } from "./types";

// Fichas com próxima data (spec 0081): previstas, vencidas, feitas, faturado e fichas de um cliente.
// O vocabulário vem do nome dos formulários de ficha da empresa — "Manutenção" responde a
// "manutenções", "Revisão" a "revisões". Nenhuma palavra de ramo fica aqui.

const MAX_ROWS = 30;
const VOCABULARY_TTL_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

const ASKS_ABOUT_RECORDS =
  /\b(quant[oa]s|quais|qual|quanto|liste|lista|listar|mostra|mostre|traga|traz|fatur\w+|previst[ao]s?|vencid[ao]s?|atrasad[ao]s?)\b/;
const GENERIC_RECORD_WORDS = /\b(fichas?|atendimentos?)\b/;
const CLIENTS_TO_SERVE = /\bclientes?\b/;
const REVENUE = /\bfatur(ei|amos|ou|amento|ado|ada)\b/;
const DONE = /\b(fiz|fizemos|feit[ao]s?|realizad[ao]s?|realizei|finalizad[ao]s?|concluid[ao]s?)\b/;
const OVERDUE = /\b(vencid[ao]s?|atrasad[ao]s?)\b/;
const LISTS = /\b(quais|liste|lista|listar|mostra|mostre|traga|traz)\b/;
/** "Fichas de manutenção eu tenho": o que vem depois do "de" é resto de frase, não nome de cliente. */
const NOT_A_NAME = /\b(eu|tenho|temos|tem|que|para|pra|hoje|amanha|semana|mes|previst\w*|feit\w*)\b/;
const OF_CLIENT = /\b(?:d[aoe]|do cliente|da cliente)\s+([a-z0-9][a-z0-9 .'-]{1,60})$/;

interface RecordForm {
  id: string;
  name: string;
  /** Nome sem acento, no singular e no plural, como a pessoa escreveria. */
  spokenForms: string[];
}

interface RecordVocabulary {
  forms: RecordForm[];
  hasNextDates: boolean;
  expiresAt: number;
}

const globalForVocabulary = globalThis as unknown as { astroRecordVocabulary?: Map<string, RecordVocabulary> };
const vocabularyByOrganization = (globalForVocabulary.astroRecordVocabulary ??= new Map<string, RecordVocabulary>());

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plural em português da primeira palavra: "manutencao" → "manutencoes", "ordem de servico" → "ordens de servico". */
export function pluralizeSpokenName(normalizedName: string): string {
  const [firstWord, ...rest] = normalizedName.split(" ");
  const pluralFirst = firstWord.endsWith("ao")
    ? `${firstWord.slice(0, -2)}oes`
    : firstWord.endsWith("m")
      ? `${firstWord.slice(0, -1)}ns`
      : firstWord.endsWith("l")
        ? `${firstWord.slice(0, -1)}is`
        : /[rsz]$/.test(firstWord)
          ? `${firstWord}es`
          : `${firstWord}s`;
  return [pluralFirst, ...rest].join(" ");
}

async function loadVocabulary(organizationId: string): Promise<RecordVocabulary> {
  const cached = vocabularyByOrganization.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const [formGroups, recordWithNextDate] = await Promise.all([
    prisma.formRecord.groupBy({ by: ["formId"], where: { organizationId } }),
    prisma.formRecord.findFirst({ where: { organizationId, nextDueAt: { not: null } }, select: { id: true } }),
  ]);
  const forms =
    formGroups.length > 0
      ? await prisma.form.findMany({
          where: { organizationId, id: { in: formGroups.map((group) => group.formId) } },
          select: { id: true, name: true },
        })
      : [];
  const vocabulary: RecordVocabulary = {
    forms: forms.map((form) => {
      const spokenName = normalize(form.name);
      return { id: form.id, name: form.name, spokenForms: [spokenName, pluralizeSpokenName(spokenName)].filter((spoken) => spoken.length >= 3) };
    }),
    hasNextDates: Boolean(recordWithNextDate),
    expiresAt: Date.now() + VOCABULARY_TTL_MS,
  };
  vocabularyByOrganization.set(organizationId, vocabulary);
  return vocabulary;
}

/** De que fichas a pergunta fala: de um formulário nomeado, de todas ("fichas", "atendimentos"), ou de nenhuma. */
function resolveSubject(text: string, vocabulary: RecordVocabulary): { formIds: string[]; noun: { one: string; many: string } } | null {
  const namedForm = vocabulary.forms.find((form) => form.spokenForms.some((spoken) => new RegExp(`\\b${spoken}\\b`).test(text)));
  if (namedForm) {
    const lowerName = namedForm.name.toLowerCase();
    return { formIds: [namedForm.id], noun: { one: lowerName, many: pluralLabel(lowerName) } };
  }
  const allFormIds = vocabulary.forms.map((form) => form.id);
  if (GENERIC_RECORD_WORDS.test(text)) return { formIds: allFormIds, noun: { one: "ficha", many: "fichas" } };
  // "Quantos clientes tenho essa semana?" e "quanto faturei?" só são sobre fichas em empresa que usa próxima data.
  if (vocabulary.hasNextDates && (REVENUE.test(text) || (CLIENTS_TO_SERVE.test(text) && Boolean(periodFrom(text))))) {
    return { formIds: allFormIds, noun: { one: "ficha", many: "fichas" } };
  }
  return null;
}

/** Plural do rótulo com acento, para a resposta: "manutenção" → "manutenções". */
function pluralLabel(lowerName: string): string {
  const [firstWord, ...rest] = lowerName.split(" ");
  const pluralFirst = firstWord.endsWith("ão")
    ? `${firstWord.slice(0, -2)}ões`
    : firstWord.endsWith("m")
      ? `${firstWord.slice(0, -1)}ns`
      : firstWord.endsWith("l")
        ? `${firstWord.slice(0, -1)}is`
        : /[rsz]$/.test(firstWord)
          ? `${firstWord}es`
          : `${firstWord}s`;
  return [pluralFirst, ...rest].join(" ");
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

type ListedRecord = { id: string; leadId: string | null; label: string | null; nextDueAt: Date | null; referenceDate: Date; usageTotalCents: number };

async function toTable(params: {
  organizationId: string;
  title: string;
  records: ListedRecord[];
  totalCount: number;
  dateColumn: { label: string; read: (record: ListedRecord) => Date | null };
  showValue: boolean;
}): Promise<AstroQueryResult["table"]> {
  const leadIds = [...new Set(params.records.map((record) => record.leadId).filter((leadId): leadId is string => Boolean(leadId)))];
  const leads =
    leadIds.length > 0
      ? await prisma.lead.findMany({ where: { id: { in: leadIds }, tracking: { organizationId: params.organizationId } }, select: { id: true, name: true } })
      : [];
  const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));
  return {
    kind: "astro_table",
    entityType: "lead",
    title: params.title,
    columns: [
      { key: "cliente", label: "Cliente" },
      { key: "ficha", label: "Ficha" },
      { key: "data", label: params.dateColumn.label },
      ...(params.showValue ? [{ key: "valor", label: "Valor" }] : []),
    ],
    rows: params.records.map((record) => {
      const date = params.dateColumn.read(record);
      return {
        id: record.leadId ?? record.id,
        cliente: record.leadId ? (leadNameById.get(record.leadId) ?? "Cliente removido") : "Sem cliente",
        ficha: record.label ?? "",
        data: date ? formatDay(date) : "",
        valor: params.showValue ? money(record.usageTotalCents) : undefined,
      };
    }),
    totalCount: params.totalCount,
  };
}

const LISTED_SELECT = { id: true, leadId: true, label: true, nextDueAt: true, referenceDate: true, usageTotalCents: true } as const;

const recordsQuery: AstroQuery = {
  key: "form.records",
  app: "form",
  appKey: "formularios",
  matches: (text) => ASKS_ABOUT_RECORDS.test(text),
  run: async ({ ctx, text }) => {
    const organizationId = ctx.organizationId;
    const vocabulary = await loadVocabulary(organizationId);
    if (vocabulary.forms.length === 0) return null;
    const normalizedText = normalize(text);
    const subject = resolveSubject(normalizedText, vocabulary);
    if (!subject) return null;

    const period = periodFrom(normalizedText);
    const scope = { organizationId, formId: { in: subject.formIds } };
    const countLabel = (count: number) => `${count} ${plural(count, subject.noun.one, subject.noun.many)}`;

    // Feitas e faturado: fichas finalizadas pela data da ficha. Sem período, o mês corrente.
    if (REVENUE.test(normalizedText) || DONE.test(normalizedText)) {
      const since = period?.since ?? startOfMonth();
      const until = period?.until ?? new Date(startOfToday().getTime() + DAY_MS);
      const periodLabel = period?.label ?? "neste mês";
      const where = { ...scope, finalizedAt: { not: null }, referenceDate: { gte: since, lt: until } };
      const [doneCount, revenue] = await Promise.all([
        prisma.formRecord.count({ where }),
        prisma.formRecord.aggregate({ where, _sum: { usageTotalCents: true } }),
      ]);
      const revenueCents = revenue._sum.usageTotalCents ?? 0;
      if (doneCount === 0) return { text: `Nenhuma ficha finalizada ${periodLabel}.` };
      const summary = REVENUE.test(normalizedText)
        ? `${money(revenueCents)} faturado ${periodLabel}, em ${countLabel(doneCount)}`
        : `${countLabel(doneCount)} ${plural(doneCount, "feita", "feitas")} ${periodLabel}, somando ${money(revenueCents)}`;
      if (!LISTS.test(normalizedText)) return { text: `${summary}.` };
      const records = await prisma.formRecord.findMany({ where, orderBy: { referenceDate: "desc" }, take: MAX_ROWS, select: LISTED_SELECT });
      return {
        text: `${summary}:`,
        table: await toTable({ organizationId, title: "Fichas finalizadas", records, totalCount: doneCount, dateColumn: { label: "Data", read: (record) => record.referenceDate }, showValue: true }),
      };
    }

    // Fichas de um cliente: "me mostra as manutenções da Maria".
    const spokenClientName = !period && !OVERDUE.test(normalizedText) ? normalizedText.match(OF_CLIENT)?.[1]?.trim() : undefined;
    // "Fichas de atendimento" nomeia o formulário, não um cliente.
    const isFormName = vocabulary.forms.some((form) => form.spokenForms.some((spoken) => (spokenClientName ?? "").startsWith(spoken)));
    const isClientName =
      Boolean(spokenClientName) &&
      !isFormName &&
      !GENERIC_RECORD_WORDS.test(spokenClientName ?? "") &&
      !NOT_A_NAME.test(spokenClientName ?? "") &&
      (spokenClientName ?? "").split(" ").length <= 4;
    const clientName = isClientName ? spokenClientName : undefined;
    if (clientName) {
      // A frase chega sem acento ("kaue") e o banco compara com acento ("Kauê"): a busca é feita
      // em memória, só entre os clientes que têm ficha.
      const clientGroups = await prisma.formRecord.groupBy({ by: ["leadId"], where: { ...scope, leadId: { not: null } } });
      const clientIds = clientGroups.map((group) => group.leadId).filter((leadId): leadId is string => Boolean(leadId));
      const clients =
        clientIds.length > 0
          ? await prisma.lead.findMany({ where: { id: { in: clientIds }, tracking: { organizationId } }, select: { id: true, name: true } })
          : [];
      const leads = clients.filter((client) => normalize(client.name).includes(clientName)).slice(0, 5);
      if (leads.length === 0) return { text: `Não achei cliente com "${clientName}".` };
      const where = { ...scope, leadId: { in: leads.map((lead) => lead.id) } };
      const [clientCount, records] = await Promise.all([
        prisma.formRecord.count({ where }),
        prisma.formRecord.findMany({ where, orderBy: { referenceDate: "desc" }, take: MAX_ROWS, select: LISTED_SELECT }),
      ]);
      if (clientCount === 0) return { text: `${leads[0].name} ainda não tem ${subject.noun.one}.` };
      return {
        text: `${countLabel(clientCount)} de ${leads.map((lead) => lead.name).join(", ")}:`,
        table: await toTable({ organizationId, title: "Fichas do cliente", records, totalCount: clientCount, dateColumn: { label: "Data", read: (record) => record.referenceDate }, showValue: true }),
      };
    }

    // Daqui para baixo é sobre a próxima data.
    if (!vocabulary.hasNextDates) return null;
    const today = startOfToday();
    const overdueWhere = { ...scope, nextDueAt: { lt: today } };

    if (OVERDUE.test(normalizedText)) {
      const [overdueCount, records] = await Promise.all([
        prisma.formRecord.count({ where: overdueWhere }),
        prisma.formRecord.findMany({ where: overdueWhere, orderBy: { nextDueAt: "asc" }, take: MAX_ROWS, select: LISTED_SELECT }),
      ]);
      if (overdueCount === 0) return { text: `Nenhuma ${subject.noun.one} vencida.` };
      return {
        text: `${countLabel(overdueCount)} com a data vencida:`,
        table: await toTable({ organizationId, title: "Vencidas", records, totalCount: overdueCount, dateColumn: { label: "Era para", read: (record) => record.nextDueAt }, showValue: false }),
      };
    }

    // Previstas: do começo do período (nunca antes de hoje) até o fim dele. Sem período, os próximos 7 dias.
    const windowStart = period && period.since > today ? period.since : today;
    const periodEnd = period ? (period.futureUntil > period.until ? period.futureUntil : period.until) : new Date(today.getTime() + 7 * DAY_MS);
    const windowEnd = periodEnd > windowStart ? periodEnd : new Date(windowStart.getTime() + DAY_MS);
    const periodLabel = period?.label ?? "nos próximos 7 dias";
    const plannedWhere = { ...scope, nextDueAt: { gte: windowStart, lt: windowEnd } };
    const isToday = period?.label === "hoje";

    const [plannedCount, plannedClients, overdueCount, records] = await Promise.all([
      prisma.formRecord.count({ where: plannedWhere }),
      prisma.formRecord.groupBy({ by: ["leadId"], where: { ...plannedWhere, leadId: { not: null } } }),
      isToday ? prisma.formRecord.count({ where: overdueWhere }) : Promise.resolve(0),
      prisma.formRecord.findMany({
        where: isToday ? { ...scope, nextDueAt: { lt: windowEnd } } : plannedWhere,
        orderBy: { nextDueAt: "asc" },
        take: MAX_ROWS,
        select: LISTED_SELECT,
      }),
    ]);
    const clientCount = plannedClients.length;
    const overdueNote = overdueCount > 0 ? ` e ${overdueCount} ${plural(overdueCount, "vencida", "vencidas")}` : "";
    if (plannedCount === 0 && overdueCount === 0) return { text: `Nenhuma ${subject.noun.one} prevista ${periodLabel}.` };

    const summary = CLIENTS_TO_SERVE.test(normalizedText)
      ? `${clientCount} ${plural(clientCount, "cliente", "clientes")} ${periodLabel}, em ${countLabel(plannedCount)}${overdueNote}`
      : `${countLabel(plannedCount)} ${plural(plannedCount, "prevista", "previstas")} ${periodLabel}${overdueNote}` +
        (clientCount > 0 && clientCount !== plannedCount ? `, de ${clientCount} ${plural(clientCount, "cliente", "clientes")}` : "");
    return {
      text: `${summary}:`,
      table: await toTable({
        organizationId,
        title: isToday ? "Previstas para hoje e vencidas" : "Previstas",
        records,
        totalCount: plannedCount + overdueCount,
        dateColumn: { label: "Previsto", read: (record) => record.nextDueAt },
        showValue: false,
      }),
    };
  },
};

export const RECORD_QUERIES: AstroQuery[] = [recordsQuery];
