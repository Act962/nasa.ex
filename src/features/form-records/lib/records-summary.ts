// Resumo das fichas de um filtro, para o painel da lista (spec 0075, RF-15).
// Puro: o servidor entrega as fichas filtradas e este arquivo faz as contas.

const TIME_ZONE = "America/Sao_Paulo";
/** Até aqui o gráfico é por dia; acima, por mês. */
const MAX_DAILY_BUCKETS = 62;
const TOP_LIMIT = 5;
const TOP_ITEMS_LIMIT = 8;

export interface SummaryRecord {
  referenceDate: Date;
  leadId: string | null;
  leadMemberId: string | null;
  usageTotalCents: number;
  isFinalized: boolean;
  isClosed: boolean;
  usageItems: unknown;
}

export interface SummaryRanking {
  id: string;
  name: string;
  recordCount: number;
  usageCents: number;
}

export interface SummaryItemRanking {
  name: string;
  unit: string;
  quantity: number;
  totalCents: number;
}

export interface SummaryBucket {
  /** "AAAA-MM-DD" ou "AAAA-MM". */
  key: string;
  recordCount: number;
  usageCents: number;
}

export interface RecordsSummary {
  recordCount: number;
  usageCents: number;
  averageUsageCents: number;
  clientCount: number;
  draftCount: number;
  sentCount: number;
  closedCount: number;
  granularity: "day" | "month";
  buckets: SummaryBucket[];
  topClients: SummaryRanking[];
  topMembers: SummaryRanking[];
  topItems: SummaryItemRanking[];
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia da ficha em Brasília, "AAAA-MM-DD". */
export function toDayKey(date: Date): string {
  return dayFormatter.format(date);
}

/** Limites de um intervalo de dias de Brasília, como instantes. `dateTo` é inclusivo. */
export function toDateRangeBounds(dateFrom?: string, dateTo?: string): { gte?: Date; lt?: Date } {
  const bounds: { gte?: Date; lt?: Date } = {};
  if (dateFrom) bounds.gte = new Date(`${dateFrom}T00:00:00-03:00`);
  if (dateTo) {
    const endOfDay = new Date(`${dateTo}T00:00:00-03:00`);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    bounds.lt = endOfDay;
  }
  return bounds;
}

function rankBy(entries: Map<string, { recordCount: number; usageCents: number }>, nameById: Map<string, string>, fallbackName: string): SummaryRanking[] {
  return [...entries.entries()]
    .map(([id, totals]) => ({ id, name: nameById.get(id) ?? fallbackName, ...totals }))
    .sort((first, second) => second.usageCents - first.usageCents || second.recordCount - first.recordCount || first.name.localeCompare(second.name, "pt-BR"))
    .slice(0, TOP_LIMIT);
}

function readUsageItems(rawItems: unknown): { name: string; unit: string; quantity: number; totalCents: number }[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.flatMap((rawItem) => {
    const item = rawItem as { name?: unknown; unit?: unknown; quantity?: unknown; lineTotalCents?: unknown } | null;
    if (!item || typeof item.name !== "string" || typeof item.quantity !== "number" || !Number.isFinite(item.quantity)) return [];
    return [
      {
        name: item.name,
        unit: typeof item.unit === "string" ? item.unit : "un",
        quantity: item.quantity,
        totalCents: typeof item.lineTotalCents === "number" && Number.isFinite(item.lineTotalCents) ? item.lineTotalCents : 0,
      },
    ];
  });
}

export function summarizeRecords(params: {
  records: readonly SummaryRecord[];
  leadNameById: Map<string, string>;
  memberNameById: Map<string, string>;
}): RecordsSummary {
  const { records } = params;
  const usageCents = records.reduce((total, record) => total + record.usageTotalCents, 0);

  const byClient = new Map<string, { recordCount: number; usageCents: number }>();
  const byMember = new Map<string, { recordCount: number; usageCents: number }>();
  const byDay = new Map<string, { recordCount: number; usageCents: number }>();
  const byItem = new Map<string, SummaryItemRanking>();
  const addTo = (totals: Map<string, { recordCount: number; usageCents: number }>, key: string, record: SummaryRecord) => {
    const current = totals.get(key) ?? { recordCount: 0, usageCents: 0 };
    current.recordCount += 1;
    current.usageCents += record.usageTotalCents;
    totals.set(key, current);
  };

  for (const record of records) {
    if (record.leadId) addTo(byClient, record.leadId, record);
    if (record.leadMemberId) addTo(byMember, record.leadMemberId, record);
    addTo(byDay, toDayKey(record.referenceDate), record);
    for (const item of readUsageItems(record.usageItems)) {
      const itemKey = `${item.name}|${item.unit}`;
      const current = byItem.get(itemKey) ?? { name: item.name, unit: item.unit, quantity: 0, totalCents: 0 };
      current.quantity += item.quantity;
      current.totalCents += item.totalCents;
      byItem.set(itemKey, current);
    }
  }

  const granularity = byDay.size > MAX_DAILY_BUCKETS ? "month" : "day";
  const bucketTotals = new Map<string, { recordCount: number; usageCents: number }>();
  for (const [dayKey, totals] of byDay) {
    const bucketKey = granularity === "month" ? dayKey.slice(0, 7) : dayKey;
    const current = bucketTotals.get(bucketKey) ?? { recordCount: 0, usageCents: 0 };
    current.recordCount += totals.recordCount;
    current.usageCents += totals.usageCents;
    bucketTotals.set(bucketKey, current);
  }

  return {
    recordCount: records.length,
    usageCents,
    averageUsageCents: records.length > 0 ? Math.round(usageCents / records.length) : 0,
    clientCount: byClient.size,
    draftCount: records.filter((record) => !record.isFinalized).length,
    sentCount: records.filter((record) => record.isFinalized && !record.isClosed).length,
    closedCount: records.filter((record) => record.isClosed).length,
    granularity,
    buckets: [...bucketTotals.entries()].map(([key, totals]) => ({ key, ...totals })).sort((first, second) => first.key.localeCompare(second.key)),
    topClients: rankBy(byClient, params.leadNameById, "Cliente removido"),
    topMembers: rankBy(byMember, params.memberNameById, "Vinculado removido"),
    topItems: [...byItem.values()]
      .sort((first, second) => second.totalCents - first.totalCents || second.quantity - first.quantity || first.name.localeCompare(second.name, "pt-BR"))
      .slice(0, TOP_ITEMS_LIMIT),
  };
}
