/** Formata centavos para R$ */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Formata data ISO para DD/MM/YYYY */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}

/** Status label */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

export const STATUS_COLORS: Record<string, string> = {
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

/** Verifica se uma data está vencida */
export function isOverdue(dueDate: Date | string, status: string): boolean {
  if (status === "PAID" || status === "CANCELLED") return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return d < new Date();
}
