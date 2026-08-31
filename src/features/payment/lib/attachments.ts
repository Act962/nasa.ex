// Regras compartilhadas de anexo financeiro (spec 0008). Vive fora de
// `server/` porque o form precisa das mesmas constantes pra dar feedback antes
// de gastar upload — mas a validação que vale é a do servidor (CB-5).

export const PAYMENT_ATTACHMENT_KINDS = [
  "NOTA_FISCAL",
  "BOLETO",
  "RECIBO",
  "COMPROVANTE",
  "CONTRATO",
  "OUTRO",
] as const;

export type PaymentAttachmentKind = (typeof PAYMENT_ATTACHMENT_KINDS)[number];

export const ATTACHMENT_KIND_LABELS: Record<PaymentAttachmentKind, string> = {
  NOTA_FISCAL: "Nota fiscal",
  BOLETO: "Boleto",
  RECIBO: "Recibo",
  COMPROVANTE: "Comprovante",
  CONTRATO: "Contrato",
  OUTRO: "Outro",
};

/** Mesmo teto do upload de vídeo de Script (spec 0004) — RNF-2. */
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIMETYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/xml",
  "text/xml",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ACCEPT_ATTACHMENT_TYPES =
  ALLOWED_ATTACHMENT_MIMETYPES.join(",") + ",.pdf,.xml,.csv,.xlsx,.docx";

export function isAllowedAttachmentType(mimeType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIMETYPES as readonly string[]).includes(mimeType);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Palpite do tipo de documento a partir do nome do arquivo. É só um default
 * pra poupar cliques — o usuário troca no seletor de qualquer jeito.
 */
export function guessAttachmentKind(fileName: string): PaymentAttachmentKind {
  const normalized = fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(nota|nfe|nf-e|nfse|danfe)/.test(normalized)) return "NOTA_FISCAL";
  if (/(boleto|cobranca|fatura)/.test(normalized)) return "BOLETO";
  if (/recibo/.test(normalized)) return "RECIBO";
  if (/(comprovante|\bpix\b|transferencia|\bted\b)/.test(normalized)) return "COMPROVANTE";
  if (/(contrato|proposta|orcamento)/.test(normalized)) return "CONTRATO";
  return "OUTRO";
}
