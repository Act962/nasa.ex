import type { InboundEvent } from "../domain/types";

/**
 * Traduz o payload de um provider para o evento canônico do domínio.
 *
 * `verifySignature` recebe o **raw body**: reparsear e re-serializar o JSON
 * muda bytes e quebra o HMAC.
 */
export interface InboundTranslator {
  verifySignature(input: {
    rawBody: string;
    signatureHeader: string | null;
    appSecret: string;
  }): boolean;

  parse(payload: unknown): InboundEvent[];
}
