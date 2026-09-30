import type { ReportPeriod } from "./report-period";

export interface TrialBalanceCsvRow {
  code: string;
  name: string;
  openingCents: number;
  debitCents: number;
  creditCents: number;
  closingCents: number;
}

function formatCsvReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function escapeCsvText(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/** Gera e baixa o balancete em CSV (separador ;, reais com vírgula — abre direto no Excel pt-BR). */
export function downloadTrialBalanceCsv(rows: TrialBalanceCsvRow[], period: ReportPeriod): void {
  const header = ["Código", "Conta", "Saldo anterior", "Débitos", "Créditos", "Saldo final"].join(";");
  const lines = rows.map((row) =>
    [
      escapeCsvText(row.code),
      escapeCsvText(row.name),
      formatCsvReais(row.openingCents),
      formatCsvReais(row.debitCents),
      formatCsvReais(row.creditCents),
      formatCsvReais(row.closingCents),
    ].join(";"),
  );
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const csvContent = `﻿${[header, ...lines].join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `balancete-${period.from}-a-${period.to}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}
