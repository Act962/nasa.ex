// Constantes da caixa de entrada Gmail do financeiro (spec 0018).

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const PAYMENT_INBOX_SYNC_EVENT = "payment/inbox.sync";

export interface PaymentInboxSyncEventData {
  organizationId: string;
  triggeredByUserId?: string;
}

export const MAX_MESSAGES_PER_SYNC = 25;
export const MAX_INGESTIONS_PER_SYNC = 20;
/** Imagem pequena em e-mail costuma ser logo/assinatura, não documento. */
export const MIN_IMAGE_ATTACHMENT_BYTES = 30 * 1024;

/** Prefixo do identificador estável do anexo (partId), ver spec 0018 D-3. */
export const GMAIL_PART_KEY_PREFIX = "part:";

export const IGNORE_CONFIDENCE_THRESHOLD = 0.4;
