import {
  COMPANY_DOCUMENT_TYPES,
  isDocumentApplicable,
  type ApplicabilityProfile,
  type CompanyDocumentType,
  type RequirementOverride,
} from "./document-catalog";

export type RegularityItemStatus = "OK" | "EXPIRING_SOON" | "MISSING" | "EXPIRED" | "OVERDUE";

export interface StoredCompanyDocument {
  id: string;
  typeCode: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  period: string | null;
  createdAt: Date;
  status: string;
}

/** Cumprimento de um item mensal num mês "AAAA-MM", calculado pelo servidor. */
export interface MonthlyFulfillment {
  typeCode: string;
  period: string;
  dueDate: Date;
  isFulfilled: boolean;
}

export interface RegularityItem {
  typeCode: string;
  label: string;
  group: CompanyDocumentType["group"];
  scope: CompanyDocumentType["scope"];
  weight: number;
  status: RegularityItemStatus;
  expiresAt: Date | null;
  daysToExpire: number | null;
  documentId: string | null;
  /** Meses em aberto (itens mensais). */
  openPeriods: string[];
  /** Pontos que o item devolve ao score quando resolvido (0..10000). */
  impactBps: number;
  blockingImpact: string | null;
}

export interface RegularityScore {
  scoreBps: number;
  items: RegularityItem[];
  applicableCount: number;
  okCount: number;
  blockingItems: RegularityItem[];
}

export const EXPIRING_SOON_DAYS = 30;
const DAY_MS = 86_400_000;

export interface ComputeRegularityScoreInput {
  profile: ApplicabilityProfile;
  overrides: RequirementOverride[];
  documents: StoredCompanyDocument[];
  monthlyFulfillments: MonthlyFulfillment[];
  today: Date;
  catalog?: CompanyDocumentType[];
}

/**
 * Score = Σ peso dos itens em dia ÷ Σ peso dos itens aplicáveis. "Vencendo"
 * ainda conta como em dia (é só alerta); um único mês de guia ou nota em
 * aberto já zera o item mensal.
 */
export function computeRegularityScore(input: ComputeRegularityScoreInput): RegularityScore {
  const catalog = input.catalog ?? COMPANY_DOCUMENT_TYPES;
  const overridesByCode = new Map(input.overrides.map((override) => [override.typeCode, override]));
  const items: RegularityItem[] = [];

  for (const documentType of catalog) {
    const override = overridesByCode.get(documentType.code);
    if (!isDocumentApplicable(documentType, input.profile, override)) continue;
    const weight = override?.weight ?? documentType.weight;
    const validityDays = override?.defaultValidityDays ?? documentType.defaultValidityDays;

    if (documentType.recurrence === "MONTHLY") {
      const openPeriods = input.monthlyFulfillments
        .filter(
          (fulfillment) =>
            fulfillment.typeCode === documentType.code &&
            !fulfillment.isFulfilled &&
            fulfillment.dueDate.getTime() < input.today.getTime(),
        )
        .map((fulfillment) => fulfillment.period)
        .sort();
      items.push(buildItem(documentType, weight, openPeriods.length > 0 ? "OVERDUE" : "OK", null, null, null, openPeriods));
      continue;
    }

    const typeDocuments = input.documents
      .filter((document) => document.typeCode === documentType.code && document.status !== "REPLACED")
      .sort((left, right) => resolveReferenceDate(right).getTime() - resolveReferenceDate(left).getTime());
    const latest = typeDocuments[0];

    if (!latest) {
      items.push(buildItem(documentType, weight, "MISSING", null, null, null, []));
      continue;
    }

    if (documentType.recurrence === "ONE_TIME" && !latest.expiresAt) {
      items.push(buildItem(documentType, weight, "OK", null, null, latest.id, []));
      continue;
    }

    const expiresAt = latest.expiresAt ?? addDays(resolveReferenceDate(latest), validityDays ?? 365);
    const daysToExpire = Math.floor((expiresAt.getTime() - input.today.getTime()) / DAY_MS);
    const status: RegularityItemStatus =
      daysToExpire < 0 ? "EXPIRED" : daysToExpire <= EXPIRING_SOON_DAYS ? "EXPIRING_SOON" : "OK";
    items.push(buildItem(documentType, weight, status, expiresAt, daysToExpire, latest.id, []));
  }

  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  const okWeight = items
    .filter((item) => item.status === "OK" || item.status === "EXPIRING_SOON")
    .reduce((total, item) => total + item.weight, 0);
  const scoreBps = totalWeight === 0 ? 10000 : Math.round((okWeight / totalWeight) * 10000);

  for (const item of items) {
    const isPending = item.status !== "OK" && item.status !== "EXPIRING_SOON";
    item.impactBps = isPending && totalWeight > 0 ? Math.round((item.weight / totalWeight) * 10000) : 0;
  }

  const sorted = [...items].sort(
    (left, right) => right.impactBps - left.impactBps || statusRank(left.status) - statusRank(right.status),
  );

  return {
    scoreBps,
    items: sorted,
    applicableCount: items.length,
    okCount: items.filter((item) => item.status === "OK" || item.status === "EXPIRING_SOON").length,
    blockingItems: sorted.filter(
      (item) => item.blockingImpact !== null && (item.status === "EXPIRED" || item.status === "OVERDUE" || item.status === "MISSING") && item.weight >= 3,
    ),
  };
}

function buildItem(
  documentType: CompanyDocumentType,
  weight: number,
  status: RegularityItemStatus,
  expiresAt: Date | null,
  daysToExpire: number | null,
  documentId: string | null,
  openPeriods: string[],
): RegularityItem {
  return {
    typeCode: documentType.code,
    label: documentType.label,
    group: documentType.group,
    scope: documentType.scope,
    weight,
    status,
    expiresAt,
    daysToExpire,
    documentId,
    openPeriods,
    impactBps: 0,
    blockingImpact: documentType.blockingImpact,
  };
}

function resolveReferenceDate(document: StoredCompanyDocument): Date {
  return document.issuedAt ?? document.createdAt;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function statusRank(status: RegularityItemStatus): number {
  switch (status) {
    case "OVERDUE":
      return 0;
    case "EXPIRED":
      return 1;
    case "MISSING":
      return 2;
    case "EXPIRING_SOON":
      return 3;
    default:
      return 4;
  }
}
