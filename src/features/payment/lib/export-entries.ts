// Exportação CSV dos lançamentos do período — separador ";" e BOM UTF-8
// porque o Excel em pt-BR abre assim sem quebrar acento nem juntar colunas.
import { formatDate, STATUS_LABELS } from "./format";

export type ExportableEntry = {
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: Date | string;
  paidAt: Date | string | null;
  status: string;
  contact: { name: string } | null;
  category: { name: string } | null;
};

const CSV_HEADER = [
  "Tipo",
  "Descrição",
  "Contato",
  "Categoria",
  "Valor",
  "Vencimento",
  "Status",
  "Pago em",
  "Valor pago",
];

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toDecimal(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function buildEntriesCsv(entries: ExportableEntry[]): string {
  const rows = entries.map((entry) => [
    entry.type === "RECEIVABLE" ? "Receita" : "Despesa",
    entry.description,
    entry.contact?.name ?? "",
    entry.category?.name ?? "",
    toDecimal(entry.amount),
    formatDate(entry.dueDate),
    STATUS_LABELS[entry.status] ?? entry.status,
    entry.paidAt ? formatDate(entry.paidAt) : "",
    toDecimal(entry.paidAmount),
  ]);

  return [CSV_HEADER, ...rows]
    .map((cells) => cells.map(escapeCsvCell).join(";"))
    .join("\r\n");
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
