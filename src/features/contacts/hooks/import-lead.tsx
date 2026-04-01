import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface LeadImportField {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "email" | "phone" | "number" | "enum";
  enumValues?: string[];
}

export interface LeadImportItem {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  description?: string;
  amount?: number;
  temperature?: "COLD" | "WARM" | "HOT" | "VERY_HOT";
  source?: "DEFAULT" | "WHATSAPP" | "FORM" | "AGENDA" | "OTHER";
  profile?: string;
  createdAt?: string;
}

export interface LeadImportPayload {
  leads: LeadImportItem[];
}

export const LEAD_FIELDS: LeadImportField[] = [
  { key: "name", label: "Nome", required: true, type: "string" },
  { key: "email", label: "E-mail", required: false, type: "email" },
  { key: "phone", label: "Telefone", required: false, type: "phone" },
  {
    key: "document",
    label: "Documento (CPF/CNPJ)",
    required: false,
    type: "string",
  },
  { key: "description", label: "Descrição", required: false, type: "string" },
  { key: "amount", label: "Valor", required: false, type: "number" },
  {
    key: "temperature",
    label: "Temperatura",
    required: false,
    type: "enum",
    enumValues: ["COLD", "WARM", "HOT", "VERY_HOT"],
  },
  {
    key: "source",
    label: "Origem",
    required: false,
    type: "enum",
    enumValues: ["DEFAULT", "WHATSAPP", "FORM", "AGENDA", "OTHER"],
  },
  { key: "profile", label: "Perfil", required: false, type: "string" },
  {
    key: "createdAt",
    label: "Data de Entrada",
    required: false,
    type: "string",
  },
];

export type ColumnMapping = Record<string, string>; // csvColumn -> leadField key

export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export async function parseFile(file: File): Promise<ParsedFileResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "txt") {
    return parseCsv(file);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseXlsx(file);
  }
  throw new Error("Formato não suportado. Use CSV, XLS ou XLSX.");
}

function parseCsv(file: File): Promise<ParsedFileResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        resolve({ headers, rows, totalRows: rows.length });
      },
      error(err) {
        reject(new Error(`Erro ao ler CSV: ${err.message}`));
      },
    });
  });
}

/**
 * Converte um valor de célula XLSX para string.
 * Trata o caso mais comum de datas salvas como serial numérico do Excel
 * (ex: 45925) e objetos Date entregues quando cellDates: true.
 */
function xlsxCellToString(value: unknown): string {
  // Objeto Date (cellDates: true entrega Date direto em algumas versões)
  if (value instanceof Date && !isNaN(value.getTime())) {
    return dateToDateString(value, true /* isUTC */);
  }

  const str = String(value ?? "").trim();

  // String ISO gerada pelo XLSX com raw:false  →  "2024-04-01T00:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return dateToDateString(d, true);
  }

  return str;
}

function dateToDateString(d: Date, utc: boolean): string {
  const day = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, "0");
  const month = String(utc ? d.getUTCMonth() + 1 : d.getMonth() + 1).padStart(
    2,
    "0",
  );
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function parseXlsx(file: File): Promise<ParsedFileResult> {
  const buffer = await file.arrayBuffer();

  // cellDates: true  → XLSX converte seriais de data em objetos Date
  // raw: false       → fallback: valores formatados como string (inclui datas ISO)
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  return {
    headers,
    rows: jsonData.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, xlsxCellToString(v)]),
      ),
    ),
    totalRows: jsonData.length,
  };
}

export function buildImportPayload(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): LeadImportPayload {
  const leads: LeadImportItem[] = rows
    .map((row) => {
      const lead: Partial<LeadImportItem> & { name?: string } = {};

      for (const [csvCol, fieldKey] of Object.entries(mapping)) {
        if (!fieldKey || fieldKey === "__skip__") continue;
        const field = LEAD_FIELDS.find((f) => f.key === fieldKey);
        const raw = row[csvCol]?.trim();
        if (!raw) continue;

        if (field?.type === "number") {
          (lead as any)[fieldKey] =
            parseFloat(raw.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
        } else {
          (lead as any)[fieldKey] = raw;
        }
      }

      return lead;
    })
    .filter((lead): lead is LeadImportItem => !!lead.name);

  return { leads };
}

export async function importLeads(
  apiBaseUrl: string,
  payload: LeadImportPayload,
  token: string,
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const response = await fetch(`${apiBaseUrl}/api/leads/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Erro desconhecido" }));
    throw new Error(error.message || `Erro ${response.status}`);
  }

  return response.json();
}
