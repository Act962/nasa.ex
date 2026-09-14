/** Referência curta do PIX — o que o cliente manda junto do comprovante. */

// Sem I, O, 0 e 1: o cliente vai ditar isso no WhatsApp.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PIX_REFERENCE_PREFIX = "TGP-";

export function generatePixReference(): string {
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${PIX_REFERENCE_PREFIX}${suffix}`;
}

export function normalizePixReference(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s/g, "");
  return clean.startsWith(PIX_REFERENCE_PREFIX)
    ? clean
    : `${PIX_REFERENCE_PREFIX}${clean.replace(/^TGP-?/, "")}`;
}

/** Texto que o cliente envia ao time junto do comprovante. */
export function buildPixReceiptMessage(params: {
  reference: string;
  amountLabel: string;
  businessName?: string | null;
}): string {
  return [
    `Olá! Acabei de pagar por PIX a minha campanha no trafeGO.`,
    `Referência: ${params.reference}`,
    `Valor: ${params.amountLabel}`,
    params.businessName ? `Negócio: ${params.businessName}` : null,
    "Segue o comprovante 👇",
  ]
    .filter(Boolean)
    .join("\n");
}
