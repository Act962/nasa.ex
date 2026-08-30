/** Formata centavos para R$ */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Rótulo curto pra eixo de gráfico: "R$ 15k", "-R$ 1,2M", "R$ 350".
 * O `Intl` com notation compact devolve "R$ 15 mil", largo demais pro eixo.
 */
export function formatAxisCurrency(cents: number): string {
  const value = cents / 100;
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const short = (divisor: number, suffix: string) => {
    const scaled = absolute / divisor;
    const digits = scaled >= 10 ? 0 : 1;
    return `${sign}R$ ${scaled.toFixed(digits).replace(".", ",")}${suffix}`;
  };

  if (absolute >= 1_000_000) return short(1_000_000, "M");
  if (absolute >= 1_000) return short(1_000, "k");
  return `${sign}R$ ${absolute.toFixed(0)}`;
}

/** Percentual com uma casa: 12.5 → "12,5%" */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export type Variation = { percent: number; direction: "up" | "down" | "flat" };

/**
 * Variação percentual entre dois períodos. Sem base anterior não existe
 * variação calculável — devolve `flat` em vez de inventar 100%.
 */
export function variationBetween(current: number, previous: number): Variation {
  if (previous === 0) return { percent: 0, direction: "flat" };
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(percent) < 0.05) return { percent: 0, direction: "flat" };
  return { percent: Math.abs(percent), direction: percent > 0 ? "up" : "down" };
}

/** Formata data ISO para DD/MM/YYYY */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}

/** "Hoje, 10:30" / "Ontem, 09:15" / "28/05/2026" — usado no feed de transações */
export function formatRelativeDateTime(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const time = target.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const daysApart = Math.round(
    (startOfDay(new Date()) - startOfDay(target)) / 86_400_000,
  );

  if (daysApart === 0) return `Hoje, ${time}`;
  if (daysApart === 1) return `Ontem, ${time}`;
  return formatDate(target);
}

/** Status label */
export const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  PARTIAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PAID: "bg-green-500/10 text-green-400 border-green-500/20",
  OVERDUE: "bg-red-500/10 text-red-400 border-red-500/20",
  CANCELLED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta Corrente",
  SAVINGS: "Poupança",
  CASH: "Caixa",
  DIGITAL: "Digital",
};

export const CATEGORY_TYPE_LABELS: Record<string, string> = {
  REVENUE: "Receita",
  EXPENSE: "Despesa",
  COST: "Custo",
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  SUPPLIER: "Fornecedor",
  BOTH: "Cliente/Fornecedor",
};

/** Converte R$ string para centavos */
export function parseCurrencyToCents(value: string): number {
  const cleaned = value.replace(/[R$\s.]/g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned) * 100) || 0;
}

/** Máscara progressiva de moeda: só dígitos → "R$ 1.234,56" (trata como centavos) */
export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return formatCurrency(parseInt(digits, 10));
}

/** Verifica se uma data está vencida */
export function isOverdue(dueDate: Date | string, status: string): boolean {
  if (status === "PAID" || status === "CANCELLED") return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return d < new Date();
}
