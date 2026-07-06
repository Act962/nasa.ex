import * as XLSX from "xlsx";

// Parser heurístico da planilha de metas do Winthor: estrutura hierárquica
// (bloco de filial → linhas de vendedor → linha de total), sem cabeçalho de
// colunas único — por isso não reaproveita o parser flat de import-lead.tsx.

export type SalesGoalPeriodType =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL";

export type SalesGoalEntryKind = "SELLER" | "BUCKET";

export interface ParsedSalesGoalEntry {
  externalCode: string;
  sellerName: string;
  goalName: string;
  goalAmount: number;
  entryKind: SalesGoalEntryKind;
}

export interface ParsedSalesGoalBranch {
  name: string;
  detectedTotalAmount: number | null;
  entries: ParsedSalesGoalEntry[];
}

export interface ParsedSalesGoalWorkbook {
  periodType: SalesGoalPeriodType;
  periodStart: string; // ISO yyyy-mm-dd
  periodEnd: string; // ISO yyyy-mm-dd
  label: string | null;
  detectedTotalAmount: number | null;
  branches: ParsedSalesGoalBranch[];
  warnings: string[];
}

const BUCKET_KEYWORDS = ["TREINAMENTO", "CHECK-OUT", "CHECKOUT"];

const MONTH_NAMES_PT: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARÇO: 3,
  MARCO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
};

function parseBrlAmount(raw: unknown): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const cleaned = str.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isTotalRow(cells: string[]): boolean {
  return cells.some((cell) => /TOTAL\s+EM\s+GERAL/i.test(cell));
}

function isBucketName(name: string): boolean {
  const upper = name.toUpperCase();
  return BUCKET_KEYWORDS.some((keyword) => upper.includes(keyword));
}

function extractMetaHeader(cells: string[]): {
  label: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number | null;
} | null {
  const rowText = cells.join(" ").toUpperCase();
  const match = rowText.match(/META\s+([A-ZÇÃÕÁÉÍÓÚ]+)\s*\/\s*(\d{4})/);
  if (!match) return null;

  const monthNumber = MONTH_NAMES_PT[match[1]];
  if (!monthNumber) return null;

  const year = Number(match[2]);
  const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthNumber, 0));
  const totalAmount =
    cells.map(parseBrlAmount).find((value): value is number => value !== null) ??
    null;

  return {
    label: `Meta ${match[1].charAt(0)}${match[1].slice(1).toLowerCase()}/${year}`,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    totalAmount,
  };
}

function isBranchHeaderRow(cells: string[]): boolean {
  const [first = "", second = "", third = ""] = cells;
  if (!first.trim() || second.trim() || third.trim()) return false;
  const upper = first.trim().toUpperCase();
  if (upper !== first.trim()) return false; // precisa ser tudo maiúsculo
  if (/\d/.test(upper)) return false; // filiais não têm dígito no nome
  return true;
}

export async function parseSalesGoalWorkbook(
  file: File,
): Promise<ParsedSalesGoalWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const warnings: string[] = [];
  const branches: ParsedSalesGoalBranch[] = [];

  let currentBranch: ParsedSalesGoalBranch | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let label: string | null = null;
  let detectedTotalAmount: number | null = null;

  const closeBranch = () => {
    if (!currentBranch) return;
    const branch = currentBranch;
    const sum = branch.entries.reduce((total, entry) => total + entry.goalAmount, 0);
    if (branch.detectedTotalAmount !== null && Math.abs(branch.detectedTotalAmount - sum) > 0.01) {
      warnings.push(
        `Total de "${branch.name}" não bate: planilha diz ${formatBrl(branch.detectedTotalAmount)}, soma das linhas dá ${formatBrl(sum)}.`,
      );
    }
    branches.push(branch);
    currentBranch = null;
  };

  for (const row of rows) {
    const cells = row.map((cell) => String(cell ?? "").trim());
    if (cells.every((cell) => !cell)) continue;

    const metaHeader = extractMetaHeader(cells);
    if (metaHeader) {
      label = metaHeader.label;
      periodStart = metaHeader.periodStart;
      periodEnd = metaHeader.periodEnd;
      detectedTotalAmount = metaHeader.totalAmount;
      continue;
    }

    if (isTotalRow(cells)) {
      const totalAmount =
        cells.map(parseBrlAmount).find((value): value is number => value !== null) ??
        null;
      if (currentBranch) currentBranch.detectedTotalAmount = totalAmount;
      closeBranch();
      continue;
    }

    if (isBranchHeaderRow(cells)) {
      closeBranch();
      currentBranch = { name: cells[0], detectedTotalAmount: null, entries: [] };
      continue;
    }

    const [codeCell = "", nameCell = "", valueCell = ""] = cells;
    const goalAmount = parseBrlAmount(valueCell);
    if (!currentBranch || !codeCell || !nameCell || goalAmount === null) {
      continue; // linha não reconhecida — ignorada silenciosamente
    }

    currentBranch.entries.push({
      externalCode: codeCell,
      sellerName: nameCell,
      goalName: nameCell,
      goalAmount,
      entryKind: isBucketName(nameCell) ? "BUCKET" : "SELLER",
    });
  }

  closeBranch();

  if (branches.length === 0) {
    warnings.push("Nenhuma filial/seção foi reconhecida na planilha. Confira o formato do arquivo.");
  }

  if (!periodStart || !periodEnd) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    periodStart = start.toISOString().slice(0, 10);
    periodEnd = end.toISOString().slice(0, 10);
    warnings.push(
      'Não foi possível detectar o período ("META <MÊS>/<ANO>") na planilha — usando o mês corrente. Confira antes de confirmar o import.',
    );
  }

  const overallSum = branches.reduce(
    (total, branch) => total + branch.entries.reduce((sum, entry) => sum + entry.goalAmount, 0),
    0,
  );
  if (detectedTotalAmount !== null && Math.abs(detectedTotalAmount - overallSum) > 0.01) {
    warnings.push(
      `Total geral não bate: planilha diz ${formatBrl(detectedTotalAmount)}, soma das filiais dá ${formatBrl(overallSum)}.`,
    );
  }

  return {
    periodType: "MONTHLY",
    periodStart,
    periodEnd,
    label,
    detectedTotalAmount,
    branches,
    warnings,
  };
}
