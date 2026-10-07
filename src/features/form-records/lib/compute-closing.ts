import { allocateSharedCost } from "./allocate-shared-cost";

// Fechamento de um período por cliente (spec 0075, RF-10): itens usados nas
// fichas de cada cliente + a parte dele em cada custo compartilhado, rateada
// pelo número de fichas. Puro: a tela, o servidor e o script de QA usam igual.

export interface SharedCostLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  totalCents: number;
  /** "AAAA-MM-DD", opcional — ex.: o dia em que a tinta foi produzida. */
  date: string | null;
}

export interface SharedCostGroup {
  id: string;
  name: string;
  lines: SharedCostLine[];
}

export interface ClosingRecord {
  leadId: string | null;
  usageTotalCents: number;
  isFinalized: boolean;
}

export interface ClosingShare {
  groupId: string;
  name: string;
  cents: number;
}

export interface ClosingLine {
  leadId: string;
  leadName: string;
  recordCount: number;
  usageCents: number;
  shares: ClosingShare[];
  sharedCostCents: number;
  totalCents: number;
}

export interface ClosingComputation {
  lines: ClosingLine[];
  /** Fichas que contam: finalizadas e com cliente. */
  totalRecords: number;
  usageCents: number;
  sharedCostCents: number;
  totalCents: number;
  groupTotals: ClosingShare[];
  draftCount: number;
  withoutClientCount: number;
}

const MAX_GROUPS = 10;
const MAX_LINES_PER_GROUP = 300;

function toNonNegativeInteger(rawValue: unknown): number {
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** Lê os grupos gravados (Json) descartando o que estiver malformado. */
export function parseSharedCostGroups(rawGroups: unknown): SharedCostGroup[] {
  if (!Array.isArray(rawGroups)) return [];
  return rawGroups
    .flatMap((rawGroup) => {
      if (!rawGroup || typeof rawGroup !== "object") return [];
      const group = rawGroup as Record<string, unknown>;
      if (typeof group.id !== "string" || typeof group.name !== "string") return [];
      const lines = (Array.isArray(group.lines) ? group.lines : [])
        .flatMap((rawLine) => {
          if (!rawLine || typeof rawLine !== "object") return [];
          const line = rawLine as Record<string, unknown>;
          if (typeof line.id !== "string") return [];
          const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0;
          return [
            {
              id: line.id,
              description: typeof line.description === "string" ? line.description.trim().slice(0, 120) : "",
              quantity,
              unit: typeof line.unit === "string" ? line.unit.slice(0, 20) : "un",
              totalCents: toNonNegativeInteger(line.totalCents),
              date: typeof line.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(line.date) ? line.date : null,
            },
          ];
        })
        .slice(0, MAX_LINES_PER_GROUP);
      return [{ id: group.id, name: group.name.trim().slice(0, 60) || "Custo compartilhado", lines }];
    })
    .slice(0, MAX_GROUPS);
}

export function sumGroupCents(group: SharedCostGroup): number {
  return group.lines.reduce((total, line) => total + line.totalCents, 0);
}

export function computeClosing(params: {
  records: ClosingRecord[];
  groups: SharedCostGroup[];
  leadNameById: Map<string, string>;
}): ClosingComputation {
  const draftCount = params.records.filter((record) => !record.isFinalized).length;
  const withoutClientCount = params.records.filter((record) => record.isFinalized && !record.leadId).length;

  const byLead = new Map<string, { recordCount: number; usageCents: number }>();
  for (const record of params.records) {
    if (!record.isFinalized || !record.leadId) continue;
    const current = byLead.get(record.leadId) ?? { recordCount: 0, usageCents: 0 };
    current.recordCount += 1;
    current.usageCents += record.usageTotalCents;
    byLead.set(record.leadId, current);
  }

  const weights = [...byLead.entries()].map(([leadId, totals]) => ({ key: leadId, weight: totals.recordCount }));
  const allocations = params.groups.map((group) => ({
    group,
    totalCents: sumGroupCents(group),
    byLead: allocateSharedCost(sumGroupCents(group), weights),
  }));

  const lines: ClosingLine[] = [...byLead.entries()]
    .map(([leadId, totals]) => {
      const shares = allocations.map((allocation) => ({
        groupId: allocation.group.id,
        name: allocation.group.name,
        cents: allocation.byLead.get(leadId) ?? 0,
      }));
      const sharedCostCents = shares.reduce((total, share) => total + share.cents, 0);
      return {
        leadId,
        leadName: params.leadNameById.get(leadId) ?? "Cliente removido",
        recordCount: totals.recordCount,
        usageCents: totals.usageCents,
        shares,
        sharedCostCents,
        totalCents: totals.usageCents + sharedCostCents,
      };
    })
    .sort((first, second) => first.leadName.localeCompare(second.leadName, "pt-BR"));

  const usageCents = lines.reduce((total, line) => total + line.usageCents, 0);
  const sharedCostCents = lines.reduce((total, line) => total + line.sharedCostCents, 0);
  return {
    lines,
    totalRecords: lines.reduce((total, line) => total + line.recordCount, 0),
    usageCents,
    sharedCostCents,
    totalCents: usageCents + sharedCostCents,
    groupTotals: allocations.map((allocation) => ({
      groupId: allocation.group.id,
      name: allocation.group.name,
      cents: allocation.totalCents,
    })),
    draftCount,
    withoutClientCount,
  };
}

/** Último dia do período, "AAAA-MM-DD" — vencimento e competência das contas geradas. */
export function lastDayOfPeriod(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${periodKey}-${String(lastDay).padStart(2, "0")}`;
}
