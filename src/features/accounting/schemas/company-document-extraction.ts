import { z } from "zod";
import { COMPANY_DOCUMENT_TYPES } from "@/features/accounting/lib/compliance/document-catalog";

// Leitura por IA de um documento da empresa (certidão, alvará, contrato...).
// Usado pelo `generateObject` e pelo cliente que mostra o que a IA leu — por
// isso vive em `schemas/`, sem `server-only`. Datas como texto simples (sem
// regex): regex com lookahead quebra o modo estruturado da OpenAI.

export const OTHER_DOCUMENT_KIND = "OUTRO";

const documentKindCodes = [
  OTHER_DOCUMENT_KIND,
  ...COMPANY_DOCUMENT_TYPES.map((documentType) => documentType.code),
] as [string, ...string[]];

const catalogSummary = COMPANY_DOCUMENT_TYPES.map((documentType) => `${documentType.code} = ${documentType.label}`).join("; ");

export const companyDocumentExtractionSchema = z.object({
  documentKind: z
    .enum(documentKindCodes)
    .describe(`Tipo do documento, um destes códigos: ${catalogSummary}. Use OUTRO se nenhum servir.`),
  number: z.string().nullable().describe("Número, código de controle ou protocolo do documento. null se não houver."),
  issuedAt: z.string().nullable().describe("Data de emissão no formato AAAA-MM-DD. null se não houver."),
  expiresAt: z
    .string()
    .nullable()
    .describe("Data de validade/vencimento no formato AAAA-MM-DD. null se o documento não tiver validade escrita."),
  cnpj: z.string().nullable().describe("CNPJ da empresa titular, só dígitos (14). null se não aparecer."),
  holderName: z.string().nullable().describe("Razão social ou nome do titular como aparece no documento."),
  isNegative: z
    .boolean()
    .nullable()
    .describe(
      "Só para certidões: true se for NEGATIVA ou POSITIVA COM EFEITOS DE NEGATIVA (empresa regular); false se for POSITIVA (há débitos). null nos demais documentos.",
    ),
  confidence: z.number().min(0).max(1).describe("Confiança geral da leitura, de 0 a 1."),
  warnings: z.array(z.string()).describe("Alertas curtos: campo ilegível, documento vencido, dados divergentes."),
});

export type CompanyDocumentExtraction = z.infer<typeof companyDocumentExtractionSchema>;

/** Como a leitura fica gravada em `CompanyDocument.extraction`. */
export interface StoredCompanyDocumentExtraction extends CompanyDocumentExtraction {
  extractedAt: string;
  modelId: string;
  suggestedTypeCode: string | null;
  cnpjMismatch: boolean;
}

export function isStoredCompanyDocumentExtraction(value: unknown): value is StoredCompanyDocumentExtraction {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { extractedAt?: unknown }).extractedAt === "string" &&
    typeof (value as { documentKind?: unknown }).documentKind === "string"
  );
}
