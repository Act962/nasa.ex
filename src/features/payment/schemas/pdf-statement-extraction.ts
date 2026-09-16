import { z } from "zod";

// Leitura de extrato bancário em PDF (spec 0016). Todo campo é obrigatório e
// anulável: o structured output da OpenAI recusa campo opcional.

export const MAX_PDF_STATEMENT_TRANSACTIONS = 400;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")
  .describe("Data no formato AAAA-MM-DD.");

export const pdfStatementTransactionSchema = z.object({
  postedDate: isoDate.describe("Data do lançamento na conta."),
  description: z
    .string()
    .describe("Histórico do lançamento exatamente como aparece no extrato, numa linha só."),
  amountCents: z
    .number()
    .int()
    .min(0)
    .describe("Valor ABSOLUTO em centavos (R$ 1.250,50 → 125050). O sinal vai em direction."),
  direction: z
    .enum(["CREDIT", "DEBIT"])
    .describe("CREDIT = entrada na conta (valor positivo, C). DEBIT = saída (valor negativo, D)."),
  counterpartyName: z
    .string()
    .nullable()
    .describe("Nome de quem pagou ou recebeu, quando aparece no histórico. null se não houver."),
  counterpartyDocument: z
    .string()
    .nullable()
    .describe("CPF/CNPJ da contraparte como aparece (pode vir mascarado). null se não houver."),
});

export const pdfStatementExtractionSchema = z.object({
  bankName: z.string().nullable().describe("Nome do banco emissor do extrato."),
  bankCode: z.string().nullable().describe("Código COMPE do banco (3 dígitos), se aparecer."),
  agency: z.string().nullable().describe("Agência, só dígitos."),
  accountNumber: z.string().nullable().describe("Número da conta com dígito, só dígitos."),
  currency: z.string().nullable().describe("Moeda (BRL na maioria dos casos)."),
  periodStart: isoDate.nullable().describe("Início do período do extrato."),
  periodEnd: isoDate.nullable().describe("Fim do período do extrato."),
  openingBalanceCents: z
    .number()
    .int()
    .nullable()
    .describe("Saldo anterior / inicial do período em centavos, com sinal. null se não houver."),
  ledgerBalanceCents: z
    .number()
    .int()
    .nullable()
    .describe("Saldo final do período em centavos, com sinal. null se não houver."),
  transactions: z
    .array(pdfStatementTransactionSchema)
    .describe(
      "Movimentações do período, na ordem do extrato. NÃO inclua linhas de saldo (saldo anterior, saldo do dia, saldo final).",
    ),
  warnings: z
    .array(z.string())
    .describe("Ressalvas curtas em português: páginas ilegíveis, valores inferidos, extrato cortado."),
});

export type PdfStatementExtraction = z.infer<typeof pdfStatementExtractionSchema>;
export type PdfStatementTransaction = z.infer<typeof pdfStatementTransactionSchema>;

/** Guardado em `PaymentAttachment.extraction` para não reler o mesmo arquivo. */
export interface StoredPdfStatementExtraction extends PdfStatementExtraction {
  kind: "BANK_STATEMENT";
  extractedAt: string;
  modelId: string;
  usedTextFallback: boolean;
  fileHash: string;
}

export function isStoredPdfStatementExtraction(
  value: unknown,
): value is StoredPdfStatementExtraction {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "BANK_STATEMENT" &&
    typeof (value as { fileHash?: unknown }).fileHash === "string" &&
    Array.isArray((value as { transactions?: unknown }).transactions)
  );
}
