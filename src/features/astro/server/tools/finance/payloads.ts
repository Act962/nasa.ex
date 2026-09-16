import "server-only";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";

// Formatadores compartilhados pelas tools financeiras: valores em centavos
// viram R$, datas viram dd/mm/aaaa, lançamentos viram `astro_table`.

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  PENDING: "Em aberto",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  RECEIVABLE: "Receita",
  PAYABLE: "Despesa",
};

export interface EntryTableRowSource {
  id: string;
  type: string;
  status: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  documentNumber: string | null;
  category: { name: string } | null;
  contact: { name: string } | null;
  account: { name: string } | null;
}

export function buildEntriesTable(params: {
  title: string;
  caption: string;
  totalCount: number;
  entries: EntryTableRowSource[];
}): AstroTablePayload {
  return {
    kind: "astro_table",
    entityType: "user",
    title: params.title,
    caption: params.caption,
    totalCount: params.totalCount,
    columns: [
      { key: "description", label: "Descrição" },
      { key: "typeLabel", label: "Tipo", type: "badge" },
      { key: "amount", label: "Valor", type: "currency" },
      { key: "statusLabel", label: "Status", type: "badge" },
      { key: "dueDate", label: "Vencimento", type: "date" },
      { key: "installments", label: "Parcelas" },
      { key: "category", label: "Categoria" },
      { key: "contact", label: "Fornecedor/Cliente" },
      { key: "account", label: "Conta" },
      { key: "documentNumber", label: "Documento" },
    ],
    rows: params.entries.map((entry) => ({
      id: entry.id,
      description: entry.description,
      typeLabel: ENTRY_TYPE_LABELS[entry.type] ?? entry.type,
      amount: entry.amount,
      statusLabel: ENTRY_STATUS_LABELS[entry.status] ?? entry.status,
      dueDate: entry.dueDate.toISOString(),
      installments: `${entry.installmentCurrent ?? 1}/${entry.installmentTotal ?? 1}`,
      category: entry.category?.name ?? "—",
      contact: entry.contact?.name ?? "—",
      account: entry.account?.name ?? "—",
      documentNumber: entry.documentNumber ?? "—",
    })),
  };
}

/** Resolve "2026-09" / mês+ano / range ISO num período, com default = mês atual. */
export function resolveMonthInput(input: { month?: number; year?: number }) {
  const now = new Date();
  return {
    year: input.year ?? now.getFullYear(),
    month: input.month ?? now.getMonth() + 1,
  };
}
