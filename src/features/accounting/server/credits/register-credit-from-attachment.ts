import "server-only";

import prisma from "@/lib/prisma";
import type { FinancialEntryStatus, TaxCreditStatus, TaxKind, TaxRegime } from "@/generated/prisma/client";
import { parseFiscalXml } from "@/features/accounting/lib/nfe-xml/parse-fiscal-xml";
import { toMonthKey } from "@/features/accounting/lib/format";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import { storedFiscalExtractionSchema } from "@/features/payment/schemas/financial-document-extraction";
import { documentDigits } from "@/features/payment/lib/documents/normalize-document";

// Crédito de IBS/CBS (e PIS/COFINS no Lucro Real) a partir de uma nota de
// entrada anexada no financeiro (spec 0051, item 5). XML é lido de forma
// determinística; PDF/imagem usa a extração do ASTRO já gravada no anexo.

interface InboundFiscalDocument {
  accessKey: string;
  issueDate: Date | null;
  issuerDocument: string | null;
  issuerName: string | null;
  issuerTaxRegime: TaxRegime | null;
  recipientDocument: string | null;
  totalCents: number;
  taxCents: Partial<Record<CreditTax, number>>;
}

type CreditTax = Extract<TaxKind, "CBS" | "IBS" | "PIS" | "COFINS">;

export type RegisterCreditsSkipReason =
  | "not_found"
  | "not_invoice"
  | "unreadable"
  | "own_issue"
  | "not_recipient"
  | "no_taxes";

export type RegisterCreditsResult =
  | { status: "registered"; createdCount: number; updatedCount: number; taxes: CreditTax[]; warnings: string[] }
  | { status: "skipped"; reason: RegisterCreditsSkipReason; message: string };

const XML_MIME_TYPES = new Set(["application/xml", "text/xml"]);

function isXmlAttachment(attachment: { mimeType: string; fileName: string }): boolean {
  return XML_MIME_TYPES.has(attachment.mimeType) || attachment.fileName.toLowerCase().endsWith(".xml");
}

export function creditStatusForEntry(entryStatus: FinancialEntryStatus | null | undefined): TaxCreditStatus {
  if (entryStatus === "PAID") return "AVAILABLE";
  if (entryStatus === "CANCELLED") return "GLOSSED";
  return "PENDING_PAYMENT";
}

async function readInboundDocument(attachment: {
  id: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  kind: string;
  extraction: unknown;
}): Promise<InboundFiscalDocument | RegisterCreditsSkipReason> {
  if (isXmlAttachment(attachment)) {
    const bytes = await readAttachmentBytes(attachment.fileKey);
    if (!bytes) return "unreadable";
    const parsed = parseFiscalXml(new TextDecoder("utf-8").decode(bytes));
    if (!parsed.ok) return parsed.reason === "invalid_xml" ? "unreadable" : "not_invoice";
    const fiscalDocument = parsed.document;
    if (!fiscalDocument.accessKey || fiscalDocument.accessKey === "NFSE-") return "unreadable";
    const issueDate = fiscalDocument.issueDate ? new Date(fiscalDocument.issueDate) : null;
    return {
      accessKey: fiscalDocument.accessKey,
      issueDate: issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null,
      issuerDocument: documentDigits(fiscalDocument.issuer.document),
      issuerName: fiscalDocument.issuer.name,
      issuerTaxRegime: fiscalDocument.issuer.taxRegime,
      recipientDocument: documentDigits(fiscalDocument.recipient.document),
      totalCents: fiscalDocument.totalCents,
      taxCents: {
        CBS: fiscalDocument.taxes.cbsCents,
        IBS: fiscalDocument.taxes.ibsCents,
        PIS: fiscalDocument.taxes.pisCents,
        COFINS: fiscalDocument.taxes.cofinsCents,
      },
    };
  }

  const parsedExtraction = storedFiscalExtractionSchema.safeParse(attachment.extraction);
  if (!parsedExtraction.success) {
    return attachment.kind === "NOTA_FISCAL" ? "unreadable" : "not_invoice";
  }
  const extraction = parsedExtraction.data;
  if (extraction.documentType !== "NOTA_FISCAL" && extraction.documentType !== "NFSE") return "not_invoice";

  const issuerDocument = documentDigits(extraction.issuer?.document);
  const accessKeyDigits = documentDigits(extraction.invoice?.accessKey);
  const invoiceNumber = extraction.invoice?.number ?? extraction.documentNumber ?? null;
  // Sem chave de 44 dígitos (NFS-e municipal), a identidade da nota é emitente + número.
  const accessKey =
    accessKeyDigits && accessKeyDigits.length === 44
      ? accessKeyDigits
      : invoiceNumber && issuerDocument
        ? `NF-${issuerDocument}-${invoiceNumber}`
        : `ANEXO-${attachment.id}`;
  const issueDate = extraction.issueDate ? new Date(`${extraction.issueDate}T12:00:00Z`) : null;
  const issuerTaxRegime =
    extraction.issuerTaxRegime && extraction.issuerTaxRegime !== "DESCONHECIDO" ? extraction.issuerTaxRegime : null;

  return {
    accessKey,
    issueDate: issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null,
    issuerDocument,
    issuerName: extraction.issuer?.name ?? null,
    issuerTaxRegime,
    recipientDocument: documentDigits(extraction.payer?.document),
    totalCents: extraction.amountCents ?? 0,
    taxCents: {
      CBS: extraction.taxes?.cbsCents ?? 0,
      IBS: extraction.taxes?.ibsCents ?? 0,
      PIS: extraction.taxes?.pisCents ?? 0,
      COFINS: extraction.taxes?.cofinsCents ?? 0,
    },
  };
}

const SKIP_MESSAGES: Record<RegisterCreditsSkipReason, string> = {
  not_found: "Anexo não encontrado.",
  not_invoice: "O anexo não é uma nota fiscal (XML ou nota lida pelo ASTRO).",
  unreadable: "Não consegui ler a nota. Envie o XML ou peça ao ASTRO para ler o PDF.",
  own_issue: "Nota emitida pela sua empresa é venda (saída), não gera crédito.",
  not_recipient: "A nota não está em nome da sua empresa (CNPJ do destinatário diferente).",
  no_taxes: "A nota não destaca CBS/IBS — sem crédito a registrar.",
};

function skip(reason: RegisterCreditsSkipReason): RegisterCreditsResult {
  return { status: "skipped", reason, message: SKIP_MESSAGES[reason] };
}

/**
 * Registra os créditos de uma nota de entrada. Idempotente pela chave
 * [organização, chave de acesso, tributo]; nunca mexe em crédito já USADO
 * numa apuração.
 */
export async function registerCreditsFromAttachment(params: {
  organizationId: string;
  attachmentId: string;
}): Promise<RegisterCreditsResult> {
  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id: params.attachmentId, organizationId: params.organizationId },
    select: {
      id: true,
      fileKey: true,
      fileName: true,
      mimeType: true,
      kind: true,
      extraction: true,
      entryId: true,
      entry: { select: { id: true, status: true, contactId: true } },
    },
  });
  if (!attachment) return skip("not_found");
  if (attachment.kind !== "NOTA_FISCAL" && !isXmlAttachment(attachment) && !attachment.extraction) {
    return skip("not_invoice");
  }

  const inbound = await readInboundDocument(attachment);
  if (typeof inbound === "string") return skip(inbound);

  const [organization, taxProfile] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.organizationId }, select: { cnpj: true } }),
    prisma.organizationTaxProfile.findUnique({
      where: { organizationId: params.organizationId },
      select: { regime: true },
    }),
  ]);
  const warnings: string[] = [];
  const organizationDocument = documentDigits(organization?.cnpj);
  if (organizationDocument) {
    if (inbound.issuerDocument === organizationDocument) return skip("own_issue");
    if (inbound.recipientDocument !== organizationDocument) return skip("not_recipient");
  } else {
    warnings.push("Sua empresa não tem CNPJ cadastrado: não deu para conferir se a nota é mesmo sua.");
  }

  const creditTaxes: CreditTax[] = ["CBS", "IBS"];
  if (taxProfile?.regime === "REAL") creditTaxes.push("PIS", "COFINS");
  const creditLines = creditTaxes
    .map((tax) => ({ tax, amountCents: Math.max(0, Math.round(inbound.taxCents[tax] ?? 0)) }))
    .filter((line) => line.amountCents > 0);
  if (creditLines.length === 0) return skip("no_taxes");

  const supplierContact = await findSupplierContact({
    organizationId: params.organizationId,
    supplierDocument: inbound.issuerDocument,
    fallbackContactId: attachment.entry?.contactId ?? null,
  });
  if (supplierContact && inbound.issuerTaxRegime && !supplierContact.taxRegime) {
    await prisma.paymentContact.update({
      where: { id: supplierContact.id },
      data: { taxRegime: inbound.issuerTaxRegime },
    });
  }

  const competence = toMonthKey(inbound.issueDate ?? new Date());
  const computedStatus = creditStatusForEntry(attachment.entry?.status);
  const existingCredits = await prisma.taxCredit.findMany({
    where: {
      organizationId: params.organizationId,
      accessKey: inbound.accessKey,
      tax: { in: creditLines.map((line) => line.tax) },
    },
    select: { id: true, tax: true, status: true, entryId: true },
  });

  let createdCount = 0;
  let updatedCount = 0;
  for (const line of creditLines) {
    const existing = existingCredits.find((credit) => credit.tax === line.tax);
    const sharedData = {
      attachmentId: attachment.id,
      supplierContactId: supplierContact?.id ?? null,
      supplierDocument: inbound.issuerDocument,
      supplierName: inbound.issuerName ?? supplierContact?.name ?? null,
      invoiceTotalCents: inbound.totalCents > 0 ? inbound.totalCents : null,
      competence,
    };
    if (!existing) {
      await prisma.taxCredit.upsert({
        where: {
          organizationId_accessKey_tax: {
            organizationId: params.organizationId,
            accessKey: inbound.accessKey,
            tax: line.tax,
          },
        },
        create: {
          organizationId: params.organizationId,
          accessKey: inbound.accessKey,
          tax: line.tax,
          amountCents: line.amountCents,
          entryId: attachment.entryId,
          status: computedStatus,
          ...sharedData,
        },
        update: {},
      });
      createdCount += 1;
      continue;
    }
    if (existing.status === "USED") continue;
    const entryId = attachment.entryId ?? existing.entryId;
    await prisma.taxCredit.update({
      where: { id: existing.id },
      data: {
        ...sharedData,
        amountCents: line.amountCents,
        entryId,
        status: entryId === attachment.entryId ? computedStatus : existing.status,
      },
    });
    updatedCount += 1;
  }

  return {
    status: "registered",
    createdCount,
    updatedCount,
    taxes: creditLines.map((line) => line.tax),
    warnings,
  };
}

async function findSupplierContact(params: {
  organizationId: string;
  supplierDocument: string | null;
  fallbackContactId: string | null;
}): Promise<{ id: string; name: string; taxRegime: TaxRegime | null } | null> {
  if (params.supplierDocument) {
    const candidates = await prisma.paymentContact.findMany({
      where: { organizationId: params.organizationId, document: { not: null } },
      select: { id: true, name: true, document: true, taxRegime: true },
    });
    const matched = candidates.find((contact) => documentDigits(contact.document) === params.supplierDocument);
    if (matched) return { id: matched.id, name: matched.name, taxRegime: matched.taxRegime };
  }
  if (!params.fallbackContactId) return null;
  return prisma.paymentContact.findFirst({
    where: { id: params.fallbackContactId, organizationId: params.organizationId },
    select: { id: true, name: true, taxRegime: true },
  });
}

/** Versão best-effort para os pontos de disparo (upload, vínculo, leitura do ASTRO). */
export async function registerCreditsFromAttachmentSafely(params: {
  organizationId: string;
  attachmentIds: string[];
}): Promise<void> {
  for (const attachmentId of params.attachmentIds) {
    try {
      await registerCreditsFromAttachment({ organizationId: params.organizationId, attachmentId });
    } catch (error) {
      console.error("[accounting/credits] registro de crédito falhou:", attachmentId, error);
    }
  }
}
