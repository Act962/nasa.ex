// Nome padrão dos documentos financeiros (spec 0014, D-6):
//   AAAA-MM-DD_<KIND>_<contato-slug>_<valor>_<doc>.<ext>
// Ex.: 2026-09-20_BOLETO_energisa_1250-50_nn123456.pdf
// Tudo que entra no nome é pesquisável na aba Documentos — data, tipo, contato,
// valor e número do documento.

import type { PaymentAttachmentKind } from "./attachments";

const MAX_SLUG_LENGTH = 40;
const FALLBACK_CONTACT_SLUG = "sem-contato";

export interface StandardAttachmentNameInput {
  /** Vencimento (boleto/NF), fim do período (extrato) ou criação (outros). */
  referenceDate: Date;
  kind: PaymentAttachmentKind;
  contactName?: string | null;
  amountCents?: number | null;
  documentNumber?: string | null;
  /** Extensão sem ponto. Sem ela, usa a do nome original. */
  extension?: string | null;
  originalFileName?: string | null;
}

export function slugifyForFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function extensionOf(fileName: string | null | undefined): string {
  if (!fileName || !fileName.includes(".")) return "bin";
  const extension = fileName.split(".").pop() ?? "bin";
  return extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function formatDatePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 125050 → "1250-50" (o hífen como separador decimal evita ponto no nome). */
function formatAmountPart(amountCents: number): string {
  const reais = Math.floor(Math.abs(amountCents) / 100);
  const cents = Math.abs(amountCents) % 100;
  return `${reais}-${String(cents).padStart(2, "0")}`;
}

export function buildStandardAttachmentFileName(
  input: StandardAttachmentNameInput,
): string {
  const contactSlug = input.contactName
    ? slugifyForFileName(input.contactName) || FALLBACK_CONTACT_SLUG
    : FALLBACK_CONTACT_SLUG;

  const segments = [
    formatDatePart(input.referenceDate),
    input.kind,
    contactSlug,
  ];

  if (typeof input.amountCents === "number" && input.amountCents > 0) {
    segments.push(formatAmountPart(input.amountCents));
  }

  if (input.documentNumber) {
    const documentSlug = slugifyForFileName(input.documentNumber);
    if (documentSlug) segments.push(documentSlug);
  }

  const extension = input.extension
    ? input.extension.toLowerCase().replace(/^\./, "")
    : extensionOf(input.originalFileName);

  return `${segments.join("_")}.${extension}`;
}
