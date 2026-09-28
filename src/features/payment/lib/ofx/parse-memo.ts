/**
 * Extrai a contraparte do texto livre do extrato.
 *
 * O MEMO do Nubank segue formatos estáveis, por exemplo:
 *   "Transferência enviada pelo Pix - FULANO - 51.260.729/0001-38 - BCO C6 (0336) ..."
 *   "Pagamento de boleto efetuado - <cedente>"
 *   "Compra no débito - <estabelecimento>"
 *
 * O que sai daqui alimenta a sugestão de match; nada aqui é obrigatório, e um
 * MEMO fora do padrão só resulta em menos sinal, nunca em erro.
 */

export type PaymentMemoKind =
  | "PIX_SENT"
  | "PIX_RECEIVED"
  | "BOLETO"
  | "DEBIT_CARD"
  | "INVOICE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "OTHER";

export interface ParsedMemo {
  memoKind: PaymentMemoKind;
  counterpartyName: string | null;
  counterpartyDocument: string | null;
  /** O extrato entregou o documento com dígitos ocultos (•••.123.456-••). */
  counterpartyDocumentMasked: boolean;
}

const KIND_PREFIXES: Array<{ pattern: RegExp; kind: PaymentMemoKind }> = [
  { pattern: /^transfer[êe]ncia enviada pelo pix/i, kind: "PIX_SENT" },
  { pattern: /^transfer[êe]ncia recebida pelo pix/i, kind: "PIX_RECEIVED" },
  { pattern: /^estorno de pix/i, kind: "PIX_RECEIVED" },
  { pattern: /^pagamento de boleto/i, kind: "BOLETO" },
  { pattern: /^compra no d[ée]bito/i, kind: "DEBIT_CARD" },
  { pattern: /^pagamento de fatura/i, kind: "INVOICE" },
  { pattern: /^transfer[êe]ncia recebida/i, kind: "TRANSFER_IN" },
  { pattern: /^transfer[êe]ncia enviada/i, kind: "TRANSFER_OUT" },
];

// Aceita dígitos e os bullets/asteriscos que o banco usa para ocultar parte do
// CPF. Exige pelo menos alguns dígitos reais para não casar com pontuação solta.
const DOCUMENT_PATTERN =
  /(?:[\d•*]{2,3}\.[\d•*]{3}\.[\d•*]{3}-[\d•*]{2}|[\d•*]{2}\.[\d•*]{3}\.[\d•*]{3}\/[\d•*]{4}-[\d•*]{2})/;

const MASK_CHARS = /[•*]/;

export function parsePaymentMemo(memo: string): ParsedMemo {
  const text = memo.trim();
  const memoKind =
    KIND_PREFIXES.find((entry) => entry.pattern.test(text))?.kind ?? "OTHER";

  const documentMatch = DOCUMENT_PATTERN.exec(text);
  const rawDocument = documentMatch?.[0] ?? null;
  const masked = rawDocument ? MASK_CHARS.test(rawDocument) : false;

  // O nome vem entre o prefixo e o documento: "... Pix - NOME - 123.456..."
  let counterpartyName: string | null = null;
  const segments = text.split(" - ").map((part) => part.trim());
  if (segments.length >= 2) {
    const candidate = segments[1];
    if (candidate && !DOCUMENT_PATTERN.test(candidate)) {
      counterpartyName = candidate;
    }
  }

  return {
    memoKind,
    counterpartyName,
    // Guardado como veio. Desmascarar seria inventar dado de terceiro.
    counterpartyDocument: rawDocument,
    counterpartyDocumentMasked: masked,
  };
}

/** Só os dígitos, para comparar com `PaymentContact.document`. */
export function documentDigits(value: string | null | undefined): string {
  return value ? value.replace(/\D/g, "") : "";
}
