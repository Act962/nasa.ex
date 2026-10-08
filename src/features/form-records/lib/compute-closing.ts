import { allocateSharedCost } from "./allocate-shared-cost";

// Fechamento de um período por cliente (spec 0075, RF-10): itens usados nas
// fichas de cada cliente + a parte dele em cada custo compartilhado, rateada
// pelo número de fichas. Cada vinculado do cliente com ficha é uma unidade de
// rateio própria (spec 0076, RF-7). Puro: tela, servidor e QA usam igual.

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

export type ClosingBillingMode = "TITULAR" | "PROPRIO";

export interface ClosingMemberInfo {
  name: string;
  billingMode: ClosingBillingMode;
  costCenterId: string | null;
}

export interface ClosingRecord {
  leadId: string | null;
  /** Vinculado do lead a quem a ficha se refere; null = o próprio lead. */
  leadMemberId?: string | null;
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
  /** "" = o próprio lead (ver spec 0076, D-8). */
  leadMemberId: string;
  leadMemberName: string | null;
  billingMode: ClosingBillingMode;
  costCenterId: string | null;
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
  memberInfoById?: Map<string, ClosingMemberInfo>;
}): ClosingComputation {
  const draftCount = params.records.filter((record) => !record.isFinalized).length;
  const withoutClientCount = params.records.filter((record) => record.isFinalized && !record.leadId).length;

  // Unidade de rateio: o lead, ou cada vinculado dele que tem ficha.
  const byUnit = new Map<string, { leadId: string; leadMemberId: string; recordCount: number; usageCents: number }>();
  for (const record of params.records) {
    if (!record.isFinalized || !record.leadId) continue;
    const leadMemberId = record.leadMemberId ?? "";
    const unitKey = `${record.leadId}|${leadMemberId}`;
    const current = byUnit.get(unitKey) ?? { leadId: record.leadId, leadMemberId, recordCount: 0, usageCents: 0 };
    current.recordCount += 1;
    current.usageCents += record.usageTotalCents;
    byUnit.set(unitKey, current);
  }

  const weights = [...byUnit.entries()].map(([unitKey, totals]) => ({ key: unitKey, weight: totals.recordCount }));
  const allocations = params.groups.map((group) => ({
    group,
    totalCents: sumGroupCents(group),
    byLead: allocateSharedCost(sumGroupCents(group), weights),
  }));

  const lines: ClosingLine[] = [...byUnit.entries()]
    .map(([unitKey, totals]) => {
      const shares = allocations.map((allocation) => ({
        groupId: allocation.group.id,
        name: allocation.group.name,
        cents: allocation.byLead.get(unitKey) ?? 0,
      }));
      const sharedCostCents = shares.reduce((total, share) => total + share.cents, 0);
      const memberInfo = totals.leadMemberId ? params.memberInfoById?.get(totals.leadMemberId) : undefined;
      return {
        leadId: totals.leadId,
        leadName: params.leadNameById.get(totals.leadId) ?? "Cliente removido",
        leadMemberId: totals.leadMemberId,
        leadMemberName: totals.leadMemberId ? (memberInfo?.name ?? "Vinculado removido") : null,
        billingMode: memberInfo?.billingMode ?? "TITULAR",
        costCenterId: memberInfo?.costCenterId ?? null,
        recordCount: totals.recordCount,
        usageCents: totals.usageCents,
        shares,
        sharedCostCents,
        totalCents: totals.usageCents + sharedCostCents,
      };
    })
    .sort(
      (first, second) =>
        first.leadName.localeCompare(second.leadName, "pt-BR") ||
        first.leadId.localeCompare(second.leadId) ||
        (first.leadMemberName ?? "").localeCompare(second.leadMemberName ?? "", "pt-BR"),
    );

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

export interface BillingGroupLine {
  leadId: string;
  leadName: string;
  leadMemberId: string;
  leadMemberName: string | null;
  billingMode: ClosingBillingMode;
  costCenterId: string | null;
  recordCount: number;
  usageCents: number;
  sharedCostCents: number;
  totalCents: number;
}

export interface BillingGroup<Line extends BillingGroupLine> {
  /** Estável para o mesmo fechamento: lead, ou lead + vinculado de cobrança própria. */
  key: string;
  leadId: string;
  /** Preenchido só quando a conta é do vinculado (cobrança própria). */
  ownMemberName: string | null;
  costCenterId: string | null;
  lines: Line[];
  recordCount: number;
  usageCents: number;
  sharedCostCents: number;
  totalCents: number;
}

/**
 * Uma conta a receber por grupo (spec 0076, RF-8): o titular soma o próprio
 * lead e os vinculados de cobrança "no titular"; cada vinculado de cobrança
 * própria é uma conta à parte.
 */
export function groupLinesForBilling<Line extends BillingGroupLine>(lines: readonly Line[]): BillingGroup<Line>[] {
  const groups = new Map<string, BillingGroup<Line>>();
  for (const line of lines) {
    const isOwnBilling = line.leadMemberId !== "" && line.billingMode === "PROPRIO";
    const key = isOwnBilling ? `${line.leadId}|${line.leadMemberId}` : line.leadId;
    const group =
      groups.get(key) ??
      ({
        key,
        leadId: line.leadId,
        ownMemberName: isOwnBilling ? line.leadMemberName : null,
        costCenterId: isOwnBilling ? line.costCenterId : null,
        lines: [],
        recordCount: 0,
        usageCents: 0,
        sharedCostCents: 0,
        totalCents: 0,
      } satisfies BillingGroup<Line>);
    group.lines.push(line);
    group.recordCount += line.recordCount;
    group.usageCents += line.usageCents;
    group.sharedCostCents += line.sharedCostCents;
    group.totalCents += line.totalCents;
    groups.set(key, group);
  }
  return [...groups.values()];
}
