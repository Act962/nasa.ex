import "server-only";

import { generateObject } from "ai";
import prisma from "@/lib/prisma";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  financialDocumentExtractionSchema,
  type FinancialDocumentExtraction,
  type StoredFinancialExtraction,
} from "@/features/payment/schemas/financial-document-extraction";
import { parseLinhaDigitavel } from "@/features/payment/lib/boleto/linha-digitavel";
import {
  documentDigits,
  isValidBrazilianDocument,
} from "@/features/payment/lib/documents/normalize-document";
import type { PaymentAttachmentKind } from "@/features/payment/lib/attachments";
import {
  NO_EXTRACTION_KEY_MESSAGE,
  resolveExtractionModels,
  type ResolvedExtractionModel,
} from "./resolve-extraction-model";
import { readAttachmentBytes } from "./read-attachment-bytes";
import { extractPdfText } from "./extract-pdf-text";
import { matchPaymentContact } from "./match-payment-contact";
import { findPossibleDuplicateEntries } from "./find-duplicate-entries";

// Leitura de boleto / nota fiscal / fatura (spec 0014, RF-6/RF-8). O modelo
// recebe o arquivo inteiro (vision cobre boleto escaneado); o resultado passa
// por conferências determinísticas e fica cacheado no anexo — a segunda leitura
// do mesmo arquivo não custa Stars.

export const FINANCE_EXTRACTION_STARS_ACTION = "astro_finance_document";
/** Acima disso a API recusa o PDF; cai no texto extraído localmente. */
const MAX_FILE_BYTES_FOR_MODEL = 32 * 1024 * 1024;

export type ExtractFinancialDocumentResult =
  | { ok: true; attachmentId: string; extraction: StoredFinancialExtraction; fromCache: boolean }
  | {
      ok: false;
      reason: "not_found" | "insufficient_stars" | "no_api_key" | "unsupported" | "model_failed";
      message: string;
    };

const EXTRACTION_PROMPT = `Você lê documentos financeiros brasileiros (boleto bancário, DANFE/NF-e, NFS-e, fatura de consumo, recibo) para lançar contas a pagar ou a receber num sistema financeiro.

Extraia os campos do schema com rigor:
- Valores SEMPRE em centavos inteiros (R$ 1.250,50 → 125050). Use o valor total do documento, não subtotais.
- Datas SEMPRE em AAAA-MM-DD.
- CNPJ/CPF SEMPRE só com dígitos.
- Linha digitável e código de barras só com dígitos, sem espaços ou pontos.
- "issuer" é quem emite/cobra (beneficiário, emitente, prestador). "payer" é quem paga (sacado, destinatário, tomador).
- Não invente dígitos: se um número estiver ilegível, deixe null e registre em warnings.
- "description" curta, sem markdown, útil como descrição de lançamento.
- Em nota fiscal com duplicatas/parcelas, liste todas em invoice.installments.`;

/** O anexo chega ao modelo como arquivo, imagem ou texto extraído localmente. */
type ModelFileContent =
  | [{ type: "image"; image: Uint8Array; mediaType: string }]
  | [{ type: "file"; data: Uint8Array; mediaType: string }]
  | [{ type: "text"; text: string }];

const KIND_BY_DOCUMENT_TYPE: Record<FinancialDocumentExtraction["documentType"], PaymentAttachmentKind> = {
  BOLETO: "BOLETO",
  NOTA_FISCAL: "NOTA_FISCAL",
  NFSE: "NOTA_FISCAL",
  FATURA: "BOLETO",
  RECIBO: "RECIBO",
  EXTRATO: "EXTRATO",
  OUTRO: "OUTRO",
};

function isStoredExtraction(value: unknown): value is StoredFinancialExtraction {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { extractedAt?: unknown }).extractedAt === "string" &&
    typeof (value as { documentType?: unknown }).documentType === "string"
  );
}

function validateExtraction(raw: FinancialDocumentExtraction) {
  const extraction: FinancialDocumentExtraction = {
    ...raw,
    warnings: [...raw.warnings],
    issuer: { ...raw.issuer, document: documentDigits(raw.issuer.document) },
    payer: raw.payer ? { ...raw.payer, document: documentDigits(raw.payer.document) } : null,
  };
  let confidence = raw.confidence;

  const validation: StoredFinancialExtraction["validation"] = {
    linhaDigitavelValid: null,
    issuerDocumentValid: null,
    payerDocumentValid: null,
    amountMatchesLinhaDigitavel: null,
    dueDateMatchesLinhaDigitavel: null,
  };

  if (extraction.issuer.document) {
    validation.issuerDocumentValid = isValidBrazilianDocument(extraction.issuer.document);
    if (!validation.issuerDocumentValid) {
      extraction.warnings.push("CNPJ/CPF do emissor com dígito verificador inválido");
      confidence -= 0.15;
    }
  }
  if (extraction.payer?.document) {
    validation.payerDocumentValid = isValidBrazilianDocument(extraction.payer.document);
    if (!validation.payerDocumentValid) {
      extraction.warnings.push("CNPJ/CPF do pagador com dígito verificador inválido");
      confidence -= 0.05;
    }
  }

  const linha = extraction.boleto?.linhaDigitavel
    ? parseLinhaDigitavel(extraction.boleto.linhaDigitavel)
    : null;
  if (extraction.boleto && extraction.boleto.linhaDigitavel && !linha) {
    extraction.warnings.push("Linha digitável com tamanho inesperado");
    confidence -= 0.1;
  }
  if (linha) {
    validation.linhaDigitavelValid = linha.isValid;
    extraction.boleto = {
      ...extraction.boleto!,
      linhaDigitavel: linha.digits,
      bankCode: extraction.boleto?.bankCode ?? linha.bankCode,
    };
    if (!linha.isValid) {
      extraction.warnings.push(...linha.warnings.map((warning) => `Linha digitável: ${warning}`));
      confidence -= 0.2;
    }
    if (linha.amountCents !== null) {
      if (extraction.amountCents === null) {
        extraction.amountCents = linha.amountCents;
        validation.amountMatchesLinhaDigitavel = true;
      } else {
        validation.amountMatchesLinhaDigitavel = linha.amountCents === extraction.amountCents;
        if (!validation.amountMatchesLinhaDigitavel) {
          extraction.warnings.push(
            `Valor lido (${extraction.amountCents}) difere do valor da linha digitável (${linha.amountCents}); usando o da linha`,
          );
          extraction.amountCents = linha.amountCents;
          confidence -= 0.1;
        }
      }
    }
    if (linha.dueDate) {
      const linhaDueDate = linha.dueDate.toISOString().slice(0, 10);
      if (!extraction.dueDate) {
        extraction.dueDate = linhaDueDate;
        validation.dueDateMatchesLinhaDigitavel = true;
      } else {
        validation.dueDateMatchesLinhaDigitavel = linhaDueDate === extraction.dueDate;
        if (!validation.dueDateMatchesLinhaDigitavel) {
          extraction.warnings.push(
            `Vencimento lido (${extraction.dueDate}) difere do fator da linha digitável (${linhaDueDate}); usando o da linha`,
          );
          extraction.dueDate = linhaDueDate;
          confidence -= 0.1;
        }
      }
    }
  }

  if (extraction.amountCents === null) extraction.warnings.push("Valor não identificado");
  if (extraction.dueDate === null) extraction.warnings.push("Vencimento não identificado");

  extraction.confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
  return { extraction, validation };
}

function mediaTypeOf(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function extractFinancialDocument(params: {
  organizationId: string;
  attachmentId: string;
  userId: string;
  /** Força nova leitura mesmo com cache (cobra de novo). */
  force?: boolean;
}): Promise<ExtractFinancialDocumentResult> {
  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id: params.attachmentId, organizationId: params.organizationId },
    select: {
      id: true,
      fileKey: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      kind: true,
      extraction: true,
    },
  });
  if (!attachment) {
    return { ok: false, reason: "not_found", message: "Anexo não encontrado nesta organização" };
  }

  if (!params.force && isStoredExtraction(attachment.extraction)) {
    return { ok: true, attachmentId: attachment.id, extraction: attachment.extraction, fromCache: true };
  }

  const mediaType = mediaTypeOf(attachment.mimeType, attachment.fileName);
  const isPdf = mediaType.includes("pdf");
  const isImage = mediaType.startsWith("image/");
  if (!isPdf && !isImage) {
    return {
      ok: false,
      reason: "unsupported",
      message: `Só leio PDF ou imagem por enquanto (recebi ${mediaType}).`,
    };
  }

  const candidates = await resolveExtractionModels(params.organizationId);
  if (candidates.length === 0) {
    return { ok: false, reason: "no_api_key", message: NO_EXTRACTION_KEY_MESSAGE };
  }

  const charge = await chargeStarsByAction(params.organizationId, FINANCE_EXTRACTION_STARS_ACTION, {
    userId: params.userId,
    appSlug: "astro",
    description: `Astro Financeiro — leitura de ${attachment.fileName}`,
  });
  if (!charge.success) {
    return {
      ok: false,
      reason: "insufficient_stars",
      message: "Saldo de Stars insuficiente pra ler este documento (5★).",
    };
  }

  const bytes = await readAttachmentBytes(attachment.fileKey);
  if (!bytes) {
    return { ok: false, reason: "not_found", message: "Não consegui ler o arquivo no storage." };
  }

  let usedTextFallback = false;

  const buildFileContent = async (): Promise<ModelFileContent> => {
    if (isImage) return [{ type: "image", image: bytes, mediaType }];
    if (bytes.byteLength <= MAX_FILE_BYTES_FOR_MODEL) {
      return [{ type: "file", data: bytes, mediaType: "application/pdf" }];
    }
    usedTextFallback = true;
    const text = await extractPdfText(bytes);
    if (!text) throw new Error("PDF grande demais e sem texto extraível");
    return [{ type: "text", text: `Conteúdo textual do PDF:\n\n${text}` }];
  };

  const runModel = async (
    candidate: ResolvedExtractionModel,
    fileContent: ModelFileContent,
  ) => {
    const { object } = await generateObject({
      model: candidate.model,
      schema: financialDocumentExtractionSchema,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: EXTRACTION_PROMPT }, ...fileContent],
        },
      ],
      maxOutputTokens: 2_000,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "astro-finance-extract-document",
        metadata: { posthog_distinct_id: params.userId },
      },
    });
    return object;
  };

  // Tenta cada provedor configurado, na ordem de custo. O fallback existe pra
  // indisponibilidade e limite de taxa; o modelo que de fato leu fica gravado
  // na extração, pra que uma troca silenciosa não passe despercebida.
  let raw: FinancialDocumentExtraction | null = null;
  let used: ResolvedExtractionModel | null = null;
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      raw = await runModel(candidate, await buildFileContent());
      used = candidate;
      break;
    } catch (fileError) {
      const reason = fileError instanceof Error ? fileError.message : String(fileError);
      failures.push(`${candidate.provider}/${candidate.modelId}: ${reason}`);
      console.warn(
        `[payment/documents] ${candidate.provider} falhou lendo o arquivo:`,
        fileError,
      );

      // PDF sem suporte de visão no provedor: tenta o texto extraído antes de
      // passar pro próximo.
      if (!isPdf || usedTextFallback) continue;
      const text = await extractPdfText(bytes);
      if (!text) continue;
      try {
        raw = await runModel(candidate, [
          { type: "text", text: `Conteúdo textual do PDF:\n\n${text}` },
        ]);
        used = candidate;
        usedTextFallback = true;
        break;
      } catch (textError) {
        failures.push(
          `${candidate.provider}/${candidate.modelId} (texto): ${textError instanceof Error ? textError.message : String(textError)}`,
        );
      }
    }
  }

  if (!raw || !used) {
    console.error("[payment/documents] extração falhou em todos os provedores:", failures);
    return {
      ok: false,
      reason: "model_failed",
      message: "A IA não conseguiu ler este documento. Tente outro arquivo ou confira a chave em Integrações.",
    };
  }

  const { extraction, validation } = validateExtraction(raw);
  if (usedTextFallback) extraction.warnings.push("Leitura feita a partir do texto do PDF (sem imagem)");
  if (used !== candidates[0]) {
    extraction.warnings.push(
      `O provedor principal falhou; a leitura saiu do ${used.provider} (${used.modelId}).`,
    );
  }

  const counterparty = extraction.direction === "RECEIVABLE" ? extraction.payer : extraction.issuer;
  const [contactMatch, possibleDuplicates] = await Promise.all([
    matchPaymentContact({
      organizationId: params.organizationId,
      document: counterparty?.document ?? null,
      name: counterparty?.name ?? null,
    }),
    findPossibleDuplicateEntries({
      organizationId: params.organizationId,
      documentNumber: extraction.documentNumber,
      amountCents: extraction.amountCents,
      dueDate: extraction.dueDate,
    }),
  ]);

  const stored: StoredFinancialExtraction = {
    ...extraction,
    extractedAt: new Date().toISOString(),
    modelId: `${used.provider}/${used.modelId}`,
    usedTextFallback,
    validation,
    contactMatch,
    possibleDuplicates,
  };

  const detectedKind = KIND_BY_DOCUMENT_TYPE[extraction.documentType];
  await prisma.paymentAttachment.update({
    where: { id: attachment.id },
    data: {
      extraction: stored as unknown as object,
      extractedAt: new Date(),
      ...(attachment.kind === "OUTRO" && detectedKind !== "OUTRO" ? { kind: detectedKind } : {}),
    },
  });

  return { ok: true, attachmentId: attachment.id, extraction: stored, fromCache: false };
}

export function attachmentKindForDocumentType(
  documentType: FinancialDocumentExtraction["documentType"],
): PaymentAttachmentKind {
  return KIND_BY_DOCUMENT_TYPE[documentType];
}
