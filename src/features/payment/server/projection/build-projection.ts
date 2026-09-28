// Cálculo da projeção financeira (spec 0009). Puro de propósito: recebe os
// dados já carregados e devolve o resultado, sem tocar em Prisma (D-5).

export type ProjectionEntryType = "RECEIVABLE" | "PAYABLE";

export interface ProjectionEntry {
  type: ProjectionEntryType;
  status: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  paidAt: Date | null;
}

export interface ProjectionMonth {
  /** `YYYY-MM` — chave estável, independente de fuso na renderização. */
  month: string;
  label: string;
  committedIn: number;
  committedOut: number;
  estimatedIn: number;
  estimatedOut: number;
  /** Vencido em aberto trazido para o primeiro mês (RF-7). Zero nos demais. */
  overdueIn: number;
  overdueOut: number;
  projectedBalance: number;
  /** Firme ÷ total movimentado no mês. 1 = tudo contratado (RF-12). */
  confidence: number;
}

export interface ProjectionResult {
  openingBalance: number;
  months: ProjectionMonth[];
  monthlyAverageIn: number;
  monthlyAverageOut: number;
  /** Meses fechados que alimentaram a média. < 2 desliga a estimativa (CB-2). */
  trendMonthsUsed: number;
  hasTrendBasis: boolean;
  overdueIn: number;
  overdueOut: number;
}

export interface BuildProjectionInput {
  entries: ProjectionEntry[];
  openingBalance: number;
  horizonMonths: number;
  trendWindowMonths: number;
  /** Injetado pelo caller — mantém o cálculo determinístico e conferível. */
  today: Date;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Mínimo de meses fechados para que a média valha como tendência (CB-2). */
const MIN_TREND_MONTHS = 2;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, monthIndex: number, includeYear: boolean): string {
  return includeYear
    ? `${MONTH_LABELS[monthIndex]}/${String(year).slice(2)}`
    : MONTH_LABELS[monthIndex];
}

/** Quanto ainda vai se mover: em PARTIAL, só o saldo devedor (RF-9). */
function outstandingAmount(entry: ProjectionEntry): number {
  return Math.max(0, entry.amount - entry.paidAmount);
}

function isSettled(entry: ProjectionEntry): boolean {
  return entry.status === "PAID" || entry.status === "CANCELLED";
}

export function buildProjection({
  entries,
  openingBalance,
  horizonMonths,
  trendWindowMonths,
  today,
}: BuildProjectionInput): ProjectionResult {
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const horizon: { key: string; year: number; monthIndex: number }[] = [];
  for (let offset = 0; offset < horizonMonths; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    horizon.push({
      key: monthKey(date),
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
    });
  }
  const horizonKeys = new Set(horizon.map((month) => month.key));

  // ── Firme: aberto com vencimento dentro do horizonte ────────────────────
  const committed = new Map<string, { in: number; out: number }>();
  for (const month of horizon) committed.set(month.key, { in: 0, out: 0 });

  // ── Vencido em aberto: vai todo para o primeiro mês projetado (RF-7) ────
  let overdueIn = 0;
  let overdueOut = 0;

  // ── Realizado por mês fechado, base da média (RF-5) ─────────────────────
  const realizedByMonth = new Map<string, { in: number; out: number }>();

  for (const entry of entries) {
    if (entry.status === "CANCELLED") continue;

    // Pago entra no histórico, nunca na projeção — o caixa já se moveu (RF-8).
    if (entry.status === "PAID") {
      const settledAt = entry.paidAt ?? entry.dueDate;
      if (settledAt < currentMonthStart) {
        const key = monthKey(settledAt);
        const bucket = realizedByMonth.get(key) ?? { in: 0, out: 0 };
        if (entry.type === "RECEIVABLE") bucket.in += entry.paidAmount || entry.amount;
        else bucket.out += entry.paidAmount || entry.amount;
        realizedByMonth.set(key, bucket);
      }
      continue;
    }

    if (isSettled(entry)) continue;

    const outstanding = outstandingAmount(entry);
    if (outstanding === 0) continue;

    if (entry.dueDate < currentMonthStart) {
      if (entry.type === "RECEIVABLE") overdueIn += outstanding;
      else overdueOut += outstanding;
      continue;
    }

    const key = monthKey(entry.dueDate);
    if (!horizonKeys.has(key)) continue;

    const bucket = committed.get(key)!;
    if (entry.type === "RECEIVABLE") bucket.in += outstanding;
    else bucket.out += outstanding;
  }

  // ── Média mensal realizada ──────────────────────────────────────────────
  // Percorre a janela por mês do calendário (não pelas chaves encontradas):
  // mês fechado sem movimento é um zero legítimo e deve puxar a média pra
  // baixo, em vez de sumir da conta.
  let sumIn = 0;
  let sumOut = 0;
  let monthsCounted = 0;
  for (let offset = 1; offset <= trendWindowMonths; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const bucket = realizedByMonth.get(monthKey(date));
    sumIn += bucket?.in ?? 0;
    sumOut += bucket?.out ?? 0;
    monthsCounted++;
  }

  // Só conta como base histórica se houve movimento de fato: organização nova
  // teria N meses de zero e uma média de zero que não é tendência, é ausência.
  const hasMovement = sumIn > 0 || sumOut > 0;
  const trendMonthsUsed = hasMovement ? monthsCounted : 0;
  const hasTrendBasis = hasMovement && monthsCounted >= MIN_TREND_MONTHS;

  const monthlyAverageIn = hasTrendBasis ? Math.round(sumIn / monthsCounted) : 0;
  const monthlyAverageOut = hasTrendBasis ? Math.round(sumOut / monthsCounted) : 0;

  const crossesYear = horizon.some((month) => month.year !== horizon[0].year);

  // O mês corrente já correu em parte, e o que se moveu nele está no saldo das
  // contas. Aplicar a média cheia contaria esse dinheiro duas vezes, então a
  // estimativa dele é rateada pelo que resta do mês (D-6).
  const daysInCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const remainingMonthFraction =
    (daysInCurrentMonth - today.getDate() + 1) / daysInCurrentMonth;

  let runningBalance = openingBalance;
  const months: ProjectionMonth[] = horizon.map((month, index) => {
    const bucket = committed.get(month.key)!;
    const isFirstMonth = index === 0;

    const committedIn = bucket.in + (isFirstMonth ? overdueIn : 0);
    const committedOut = bucket.out + (isFirstMonth ? overdueOut : 0);

    // A estimativa COMPLETA a média, não soma sobre o firme (D-1). No mês
    // corrente compara com o firme SEM o vencido: atraso é dinheiro de meses
    // passados, não o fluxo normal do mês que a média representa.
    const monthFactor = isFirstMonth ? remainingMonthFraction : 1;
    const committedInForTrend = isFirstMonth ? bucket.in : committedIn;
    const committedOutForTrend = isFirstMonth ? bucket.out : committedOut;

    const estimatedIn = hasTrendBasis
      ? Math.max(0, Math.round(monthlyAverageIn * monthFactor) - committedInForTrend)
      : 0;
    const estimatedOut = hasTrendBasis
      ? Math.max(0, Math.round(monthlyAverageOut * monthFactor) - committedOutForTrend)
      : 0;

    runningBalance +=
      committedIn + estimatedIn - committedOut - estimatedOut;

    const committedTotal = committedIn + committedOut;
    const estimatedTotal = estimatedIn + estimatedOut;
    const movedTotal = committedTotal + estimatedTotal;

    return {
      month: month.key,
      label: monthLabel(month.year, month.monthIndex, crossesYear),
      committedIn,
      committedOut,
      estimatedIn,
      estimatedOut,
      overdueIn: isFirstMonth ? overdueIn : 0,
      overdueOut: isFirstMonth ? overdueOut : 0,
      projectedBalance: runningBalance,
      // Mês sem nenhuma movimentação prevista é 100% conhecido, não 0% —
      // não há nada de incerto num mês vazio.
      confidence: movedTotal === 0 ? 1 : committedTotal / movedTotal,
    };
  });

  return {
    openingBalance,
    months,
    monthlyAverageIn,
    monthlyAverageOut,
    trendMonthsUsed,
    hasTrendBasis,
    overdueIn,
    overdueOut,
  };
}
