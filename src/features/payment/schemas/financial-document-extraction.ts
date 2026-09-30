import { z } from "zod";

// Schema da leitura de um documento financeiro (boleto, NF, NFS-e, fatura,
// recibo). Usado pelo `generateObject` da extração e pelo cliente que renderiza
// a proposta — por isso vive em `schemas/`, sem `server-only`.

export const FINANCIAL_DOCUMENT_TYPES = [
  "BOLETO",
  "NOTA_FISCAL",
  "NFSE",
  "FATURA",
  "RECIBO",
  "EXTRATO",
  "OUTRO",
] as const;

export type FinancialDocumentType = (typeof FINANCIAL_DOCUMENT_TYPES)[number];

const partySchema = z.object({
  name: z.string().describe("Razão social ou nome como aparece no documento."),
  document: z
    .string()
    .nullable()
    .describe("CNPJ ou CPF só com dígitos; null se não aparecer."),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")
  .describe("Data no formato AAAA-MM-DD.");

const centsOrNull = z.number().int().nullable();

// Campos fiscais (spec 0051): alimentam os créditos de IBS/CBS da aba Contábil.
// Na geração são `nullable` (o modo estrito da OpenAI exige toda chave
// presente); no tipo guardado são opcionais, porque leituras antigas não os têm.
export const fiscalTaxesSchema = z
  .object({
    icmsCents: centsOrNull,
    ipiCents: centsOrNull,
    pisCents: centsOrNull,
    cofinsCents: centsOrNull,
    issCents: centsOrNull,
    ibsCents: centsOrNull.describe("IBS destacado (estadual + municipal), em centavos."),
    cbsCents: centsOrNull.describe("CBS destacada, em centavos."),
    isCents: centsOrNull.describe("Imposto Seletivo destacado, em centavos."),
  })
  .describe("Tributos destacados no documento, em centavos. null no que não aparecer.");

export const fiscalItemSchema = z.object({
  description: z.string(),
  ncm: z.string().nullable().describe("NCM (8 dígitos) do produto, só dígitos."),
  nbs: z.string().nullable().describe("Código NBS do serviço, só dígitos."),
  cfop: z.string().nullable(),
  cst: z.string().nullable().describe("CST do IBS/CBS, quando houver."),
  cClassTrib: z.string().nullable().describe("Código de classificação tributária do IBS/CBS."),
  amountCents: z.number().int().describe("Valor do item em centavos."),
});

export const ISSUER_TAX_REGIMES = ["SIMPLES", "MEI", "PRESUMIDO", "REAL", "DESCONHECIDO"] as const;

const fiscalExtractionFields = {
  taxes: fiscalTaxesSchema
    .nullable()
    .describe("Só em NOTA_FISCAL/NFSE: tributos destacados. null nos demais documentos."),
  items: z
    .array(fiscalItemSchema)
    .nullable()
    .describe("Só em NOTA_FISCAL/NFSE: itens da nota (até 30). null nos demais documentos."),
  issuerTaxRegime: z
    .enum(ISSUER_TAX_REGIMES)
    .nullable()
    .describe(
      "Regime do emitente quando a nota informar (CRT 1/2 = SIMPLES, 4 = MEI, 3 = regime normal → PRESUMIDO se não der para distinguir). DESCONHECIDO ou null se não constar.",
    ),
};

export const financialDocumentExtractionSchema = z.object({
  documentType: z
    .enum(FINANCIAL_DOCUMENT_TYPES)
    .describe(
      "BOLETO (cobrança bancária), NOTA_FISCAL (NF-e/DANFE), NFSE (nota de serviço), FATURA (conta de consumo, telefonia, cartão), RECIBO, EXTRATO (extrato bancário), OUTRO.",
    ),
  direction: z
    .enum(["PAYABLE", "RECEIVABLE", "UNKNOWN"])
    .describe(
      "PAYABLE quando a empresa do usuário é quem paga (é o sacado/tomador/destinatário). RECEIVABLE quando ela é quem recebe (beneficiário/emitente/prestador). UNKNOWN se não dá pra saber.",
    ),
  issuer: partySchema.describe(
    "Quem emite/cobra: beneficiário do boleto, emitente da NF, prestador da NFS-e, fornecedor da fatura.",
  ),
  payer: partySchema
    .nullable()
    .describe("Quem paga: sacado/pagador do boleto, destinatário/tomador da NF. null se não aparecer."),
  amountCents: z
    .number()
    .int()
    .nullable()
    .describe(
      "Valor TOTAL a pagar em CENTAVOS (R$ 1.250,50 → 125050). Prefira 'Valor do documento' / 'Valor total da nota' / 'Total a pagar'. null se não houver.",
    ),
  dueDate: isoDate.nullable().describe("Vencimento. null se não houver."),
  issueDate: isoDate.nullable().describe("Data de emissão. null se não houver."),
  documentNumber: z
    .string()
    .nullable()
    .describe(
      "Identificador principal: 'Nosso número' ou 'Número do documento' no boleto; número da NF/NFS-e; número da fatura. null se não houver.",
    ),
  boleto: z
    .object({
      linhaDigitavel: z
        .string()
        .nullable()
        .describe("Linha digitável completa (47 ou 48 dígitos), só dígitos."),
      codigoBarras: z.string().nullable().describe("Código de barras (44 dígitos), só dígitos."),
      nossoNumero: z.string().nullable(),
      bankCode: z.string().nullable().describe("Código do banco (3 dígitos)."),
      beneficiaryName: z.string().nullable(),
      discountCents: z.number().int().nullable().describe("Desconto até o vencimento, em centavos."),
      lateFeeText: z
        .string()
        .nullable()
        .describe("Instrução de juros/multa após o vencimento, texto curto."),
    })
    .nullable()
    .describe("Preencha só quando documentType = BOLETO."),
  invoice: z
    .object({
      number: z.string().nullable(),
      series: z.string().nullable(),
      accessKey: z
        .string()
        .nullable()
        .describe("Chave de acesso da NF-e/NFS-e (44 dígitos), só dígitos."),
      installments: z
        .array(
          z.object({
            number: z.number().int().min(1),
            dueDate: isoDate,
            amountCents: z.number().int(),
          }),
        )
        .describe("Duplicatas/parcelas listadas na nota. Vazio se for pagamento único."),
    })
    .nullable()
    .describe("Preencha só quando documentType = NOTA_FISCAL ou NFSE."),
  description: z
    .string()
    .max(120)
    .describe(
      "Descrição curta para o lançamento, em português, sem markdown. Ex.: 'Energia elétrica set/2026', 'NF 1234 - Serviços de TI'.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("0 a 1. Abaixo de 0.5 quando o documento está ilegível ou faltam valor/vencimento."),
  warnings: z
    .array(z.string())
    .describe("Ressalvas curtas em português: campos ausentes, valores inferidos, documento cortado."),
  ...fiscalExtractionFields,
});

type FiscalExtractionFields = {
  [Key in keyof typeof fiscalExtractionFields]?: z.infer<(typeof fiscalExtractionFields)[Key]>;
};

export type FinancialDocumentExtraction = Omit<
  z.infer<typeof financialDocumentExtractionSchema>,
  keyof FiscalExtractionFields
> &
  FiscalExtractionFields;
export type FiscalTaxesExtraction = z.infer<typeof fiscalTaxesSchema>;
export type FiscalItemExtraction = z.infer<typeof fiscalItemSchema>;

/** Leitura tolerante dos campos fiscais de uma extração guardada (antigas não os têm). */
export const storedFiscalExtractionSchema = z.object({
  documentType: z.enum(FINANCIAL_DOCUMENT_TYPES),
  direction: z.enum(["PAYABLE", "RECEIVABLE", "UNKNOWN"]).catch("UNKNOWN"),
  issuer: z.object({ name: z.string().nullish(), document: z.string().nullish() }).nullish(),
  payer: z.object({ name: z.string().nullish(), document: z.string().nullish() }).nullish(),
  amountCents: z.number().nullish(),
  issueDate: z.string().nullish(),
  documentNumber: z.string().nullish(),
  invoice: z.object({ number: z.string().nullish(), accessKey: z.string().nullish() }).nullish(),
  taxes: fiscalTaxesSchema.partial().nullish(),
  issuerTaxRegime: z.enum(ISSUER_TAX_REGIMES).nullish().catch(null),
});

/**
 * Resultado enriquecido guardado em `PaymentAttachment.extraction`: a leitura
 * do modelo + as conferências determinísticas + o contato que bateu.
 */
export interface StoredFinancialExtraction extends FinancialDocumentExtraction {
  extractedAt: string;
  modelId: string;
  usedTextFallback: boolean;
  validation: {
    linhaDigitavelValid: boolean | null;
    issuerDocumentValid: boolean | null;
    payerDocumentValid: boolean | null;
    amountMatchesLinhaDigitavel: boolean | null;
    dueDateMatchesLinhaDigitavel: boolean | null;
  };
  contactMatch: {
    contactId: string;
    name: string;
    matchedBy: "document" | "name";
  } | null;
  possibleDuplicates: Array<{
    entryId: string;
    description: string;
    amountCents: number;
    dueDate: string;
    status: string;
  }>;
}
