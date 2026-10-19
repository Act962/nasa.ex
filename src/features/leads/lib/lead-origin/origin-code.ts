// Código de origem das páginas (spec 0114, RF-2): cada página do Linnker e cada site das Pages tem um código
// curto, calculado do id, que os botões de WhatsApp põem na mensagem pronta. Quando a mensagem chega, o código
// diz de qual página o cliente veio. Sem `server-only`: o navegador monta o link com o mesmo cálculo.

export type OriginCodeProduct = "linnker" | "pages";

const PRODUCT_PREFIX: Record<OriginCodeProduct, string> = { linnker: "L", pages: "P" };
const PREFIX_PRODUCT: Record<string, OriginCodeProduct> = { L: "linnker", P: "pages" };
// Sem 0/O e 1/I, que se confundem quando alguém digita o código.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const ORIGIN_CODE_PATTERN = /\(c[óo]d\.?\s*([LP][A-HJ-NP-Z2-9]{4})\)/i;
const WHATSAPP_HOSTS = ["wa.me", "api.whatsapp.com", "web.whatsapp.com"];

function hashOf(text: string): number {
  // FNV-1a de 32 bits: estável entre servidor e navegador.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function originCodeOf(product: OriginCodeProduct, pageId: string): string {
  let remaining = hashOf(pageId);
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index++) {
    code += CODE_ALPHABET[remaining % CODE_ALPHABET.length];
    remaining = Math.floor(remaining / CODE_ALPHABET.length);
  }
  return `${PRODUCT_PREFIX[product]}${code}`;
}

/** "Quero saber mais" → "Quero saber mais (cód. LK7Q2)". Não repete se o texto já tem um código. */
export function appendOriginCode(text: string, code: string): string {
  const trimmedText = text.trim();
  if (ORIGIN_CODE_PATTERN.test(trimmedText)) return trimmedText;
  return trimmedText ? `${trimmedText} (cód. ${code})` : `(cód. ${code})`;
}

export function extractOriginCode(text: string | null | undefined): { product: OriginCodeProduct; code: string } | null {
  const match = text?.match(ORIGIN_CODE_PATTERN);
  if (!match?.[1]) return null;
  const code = match[1].toUpperCase();
  const product = PREFIX_PRODUCT[code[0]];
  return product ? { product, code } : null;
}

export function isWhatsappUrl(url: string): boolean {
  try {
    return WHATSAPP_HOSTS.includes(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

/** Link `wa.me`/`api.whatsapp.com` com o código no fim da mensagem pronta; outros links voltam iguais. */
export function withOriginCodeInWhatsappUrl(url: string, code: string): string {
  if (!isWhatsappUrl(url)) return url;
  const parsedUrl = new URL(url);
  const textWithCode = appendOriginCode(parsedUrl.searchParams.get("text") ?? "", code);
  parsedUrl.searchParams.delete("text");
  const otherParams = parsedUrl.searchParams.toString();
  // `%20`, não "+": o WhatsApp pode mostrar o "+" na mensagem.
  return `${parsedUrl.origin}${parsedUrl.pathname}?${otherParams ? `${otherParams}&` : ""}text=${encodeURIComponent(textWithCode)}`;
}
