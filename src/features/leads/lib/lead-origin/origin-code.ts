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
  // NFC: teclado que manda "o" + acento separado (NFD) também casa com "cód".
  const match = text?.normalize("NFC").match(ORIGIN_CODE_PATTERN);
  if (!match?.[1]) return null;
  const code = match[1].toUpperCase();
  const product = PREFIX_PRODUCT[code[0]];
  return product ? { product, code } : null;
}

/** Aceita os formatos que o editor deixa digitar: com ou sem `https://`, e `whatsapp://send`. */
function parseWhatsappUrl(url: string): URL | null {
  const trimmedUrl = url.trim();
  try {
    const parsedUrl = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`);
    if (parsedUrl.protocol === "whatsapp:") return parsedUrl;
    return WHATSAPP_HOSTS.includes(parsedUrl.hostname.replace(/^www\./, "")) ? parsedUrl : null;
  } catch {
    return null;
  }
}

export function isWhatsappUrl(url: string): boolean {
  return parseWhatsappUrl(url) !== null;
}

/** Link de WhatsApp com o código no fim da mensagem pronta; outros links voltam iguais. */
export function withOriginCodeInWhatsappUrl(url: string, code: string): string {
  const parsedUrl = parseWhatsappUrl(url);
  if (!parsedUrl) return url;
  const textWithCode = appendOriginCode(parsedUrl.searchParams.get("text") ?? "", code);
  parsedUrl.searchParams.delete("text");
  const otherParams = parsedUrl.searchParams.toString();
  // `whatsapp://send` não tem origem; o resto volta como `https://host/caminho`.
  const base = parsedUrl.protocol === "whatsapp:" ? `whatsapp://${parsedUrl.host}${parsedUrl.pathname}` : `${parsedUrl.origin}${parsedUrl.pathname}`;
  // `%20`, não "+": o WhatsApp pode mostrar o "+" na mensagem.
  return `${base}?${otherParams ? `${otherParams}&` : ""}text=${encodeURIComponent(textWithCode)}`;
}
