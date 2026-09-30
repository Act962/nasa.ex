import "server-only";

import { generateObject } from "ai";
import prisma from "@/lib/prisma";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  NO_EXTRACTION_KEY_MESSAGE,
  resolveExtractionModels,
  type ResolvedExtractionModel,
} from "@/features/payment/server/documents/resolve-extraction-model";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import { extractPdfText } from "@/features/payment/server/documents/extract-pdf-text";
import { FINANCE_EXTRACTION_STARS_ACTION } from "@/features/payment/server/documents/extract-financial-document";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import {
  OTHER_DOCUMENT_KIND,
  companyDocumentExtractionSchema,
  isStoredCompanyDocumentExtraction,
  type CompanyDocumentExtraction,
  type StoredCompanyDocumentExtraction,
} from "@/features/accounting/schemas/company-document-extraction";
import { onlyDigits, parseDateOnly } from "./document-lifecycle";

// Mesma esteira da leitura de boleto/nota do financeiro (spec 0014): modelo
// mais barato com chave configurada, fallback entre provedores, mesma ação de
// Stars. A leitura fica cacheada no documento — ler de novo não cobra.

const MAX_FILE_BYTES_FOR_MODEL = 32 * 1024 * 1024;
const MAX_XML_CHARS = 60_000;

const EXTRACTION_PROMPT = `Você lê documentos de regularidade de empresas brasileiras (certidões negativas federais, estaduais e municipais, CRF do FGTS, CNDT, alvarás, licenças, contrato social, cartão CNPJ, inscrições, guias pagas, declarações, certificados digitais) para organizar a pasta de documentos da empresa.

Regras:
- Identifique o tipo pelo título e pelo órgão emissor. Em dúvida, use OUTRO.
- Datas SEMPRE em AAAA-MM-DD. "Válida até" / "validade" vai em expiresAt; "emitida em" em issuedAt.
- CNPJ só com dígitos.
- Em certidões, isNegative = true para NEGATIVA ou POSITIVA COM EFEITOS DE NEGATIVA; false para POSITIVA.
- Não invente: campo ilegível fica null e vira um aviso em warnings (em português, curto).`;

type ModelContent =
  | [{ type: "image"; image: Uint8Array; mediaType: string }]
  | [{ type: "file"; data: Uint8Array; mediaType: string }]
  | [{ type: "text"; text: string }];

export type ExtractCompanyDocumentResult =
  | { ok: true; extraction: StoredCompanyDocumentExtraction; fromCache: boolean }
  | {
      ok: false;
      reason: "not_found" | "insufficient_stars" | "no_api_key" | "unsupported" | "model_failed";
      message: string;
    };

async function buildModelContent(bytes: Uint8Array, mimeType: string): Promise<ModelContent | null> {
  if (mimeType.startsWith("image/")) return [{ type: "image", image: bytes, mediaType: mimeType }];
  if (mimeType.includes("xml")) {
    const xmlText = new TextDecoder("utf-8").decode(bytes).slice(0, MAX_XML_CHARS);
    return [{ type: "text", text: `Conteúdo XML do documento:\n\n${xmlText}` }];
  }
  if (mimeType.includes("pdf")) {
    if (bytes.byteLength <= MAX_FILE_BYTES_FOR_MODEL) {
      return [{ type: "file", data: bytes, mediaType: "application/pdf" }];
    }
    const pdfText = await extractPdfText(bytes);
    return pdfText ? [{ type: "text", text: `Conteúdo textual do PDF:\n\n${pdfText}` }] : null;
  }
  return null;
}

async function runExtraction(candidate: ResolvedExtractionModel, content: ModelContent, userId: string) {
  const { object } = await generateObject({
    model: candidate.model,
    schema: companyDocumentExtractionSchema,
    messages: [{ role: "user", content: [{ type: "text", text: EXTRACTION_PROMPT }, ...content] }],
    maxOutputTokens: 1_200,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "accounting-extract-company-document",
      metadata: { posthog_distinct_id: userId },
    },
  });
  return object;
}

function normalizeExtraction(raw: CompanyDocumentExtraction): CompanyDocumentExtraction {
  const warnings = [...raw.warnings];
  const issuedAt = parseDateOnly(raw.issuedAt) ? raw.issuedAt : null;
  const expiresAt = parseDateOnly(raw.expiresAt) ? raw.expiresAt : null;
  if (raw.issuedAt && !issuedAt) warnings.push("Data de emissão ilegível");
  if (raw.expiresAt && !expiresAt) warnings.push("Data de validade ilegível");
  if (raw.isNegative === false) warnings.push("Certidão POSITIVA: há débitos em aberto neste órgão.");
  const cnpj = onlyDigits(raw.cnpj);
  return {
    ...raw,
    issuedAt,
    expiresAt,
    cnpj: cnpj.length === 14 ? cnpj : null,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence.toFixed(2)))),
    warnings,
  };
}

export async function extractCompanyDocument(params: {
  organizationId: string;
  documentId: string;
  userId: string;
  force?: boolean;
}): Promise<ExtractCompanyDocumentResult> {
  const document = await prisma.companyDocument.findFirst({
    where: { id: params.documentId, organizationId: params.organizationId },
    select: { id: true, nboxItemId: true, extraction: true },
  });
  if (!document?.nboxItemId) {
    return { ok: false, reason: "not_found", message: "Documento sem arquivo para ler." };
  }
  if (!params.force && isStoredCompanyDocumentExtraction(document.extraction)) {
    return { ok: true, extraction: document.extraction, fromCache: true };
  }

  const item = await prisma.nBoxItem.findFirst({
    where: { id: document.nboxItemId, organizationId: params.organizationId },
    select: { url: true, name: true, mimeType: true },
  });
  if (!item?.url) return { ok: false, reason: "not_found", message: "Arquivo não encontrado." };
  const mimeType = item.mimeType ?? "application/octet-stream";
  if (!mimeType.startsWith("image/") && !mimeType.includes("pdf") && !mimeType.includes("xml")) {
    return { ok: false, reason: "unsupported", message: "Só leio PDF, imagem ou XML." };
  }

  const candidates = await resolveExtractionModels(params.organizationId);
  if (candidates.length === 0) return { ok: false, reason: "no_api_key", message: NO_EXTRACTION_KEY_MESSAGE };

  const bytes = await readAttachmentBytes(item.url);
  if (!bytes) return { ok: false, reason: "not_found", message: "Não consegui ler o arquivo no armazenamento." };
  const content = await buildModelContent(bytes, mimeType);
  if (!content) return { ok: false, reason: "unsupported", message: "Este PDF não tem texto legível." };

  const charge = await chargeStarsByAction(params.organizationId, FINANCE_EXTRACTION_STARS_ACTION, {
    userId: params.userId,
    appSlug: "astro",
    description: `Contábil — leitura do documento ${item.name}`,
  });
  if (!charge.success) {
    return { ok: false, reason: "insufficient_stars", message: "Saldo de Stars insuficiente para ler este documento." };
  }

  let raw: CompanyDocumentExtraction | null = null;
  let usedCandidate: ResolvedExtractionModel | null = null;
  for (const candidate of candidates) {
    try {
      raw = await runExtraction(candidate, content, params.userId);
      usedCandidate = candidate;
      break;
    } catch (error) {
      console.warn(`[accounting/documents] ${candidate.provider} falhou na leitura`, error);
    }
  }
  if (!raw || !usedCandidate) {
    return {
      ok: false,
      reason: "model_failed",
      message: "A IA não conseguiu ler este documento. Preencha os dados à mão ou tente outro arquivo.",
    };
  }

  const extraction = normalizeExtraction(raw);
  const organization = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { cnpj: true },
  });
  const organizationCnpj = onlyDigits(organization?.cnpj);
  const cnpjMismatch = !!extraction.cnpj && organizationCnpj.length === 14 && extraction.cnpj !== organizationCnpj;
  const suggestedTypeCode =
    extraction.documentKind !== OTHER_DOCUMENT_KIND && findDocumentType(extraction.documentKind)
      ? extraction.documentKind
      : null;

  const stored: StoredCompanyDocumentExtraction = {
    ...extraction,
    extractedAt: new Date().toISOString(),
    modelId: `${usedCandidate.provider}/${usedCandidate.modelId}`,
    suggestedTypeCode,
    cnpjMismatch,
  };
  await prisma.companyDocument.update({
    where: { id: document.id },
    data: { extraction: JSON.parse(JSON.stringify(stored)) },
  });

  return { ok: true, extraction: stored, fromCache: false };
}
