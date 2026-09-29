import type { Prisma } from "@/generated/prisma/client";

/**
 * "Sem resposta primeiro" na lista do chat: a conversa cuja última mensagem é
 * do lead vem antes das demais. São duas faixas, cada uma na ordem escolhida,
 * e o cursor carrega a faixa em que a página parou ("awaiting|<valor>").
 */

export type ConversationBand = "awaiting" | "rest";

export const AWAITING_REPLY_WHERE: Prisma.ConversationWhereInput = {
  lastMessage: { is: { fromMe: false } },
};

/** Inclui conversa sem mensagem nenhuma. */
export const NOT_AWAITING_REPLY_WHERE: Prisma.ConversationWhereInput = {
  NOT: AWAITING_REPLY_WHERE,
};

const BAND_SEPARATOR = "|";

/** Sem cursor = primeira página, começa pela faixa dos sem resposta. */
export function parseBandCursor(cursorValue?: string): { band: ConversationBand; value?: string } {
  if (!cursorValue) return { band: "awaiting" };
  const [band, ...rest] = cursorValue.split(BAND_SEPARATOR);
  if ((band === "awaiting" || band === "rest") && rest.length > 0) {
    return { band, value: rest.join(BAND_SEPARATOR) };
  }
  // Cursor antigo, sem faixa (cliente em cache): segue como antes.
  return { band: "rest", value: cursorValue };
}

export function formatBandCursor(band: ConversationBand, value: string): string {
  return `${band}${BAND_SEPARATOR}${value}`;
}
