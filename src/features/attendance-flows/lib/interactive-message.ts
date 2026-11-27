// Cabeçalho e botão de link do bloco Enviar mensagem (spec 0143). Usado pelo editor, pelo MCP e pelo envio:
// as travas valem iguais nos três.

export const LINK_BUTTON_TYPE = "CTA_URL";
export const INTERACTIVE_TEXT_LIMITS = { headerText: 60, footer: 60, linkButtonText: 20, rowDescription: 72 } as const;

export const HEADER_TYPES = ["none", "text", "image", "video", "document"] as const;
export type HeaderType = (typeof HEADER_TYPES)[number];

export interface MessageHeader {
  type: Exclude<HeaderType, "none">;
  text?: string;
  /** Chave no armazenamento (ou link https, pelo MCP). */
  mediaUrl?: string;
  fileName?: string;
}

const VARIABLE_TOKEN = /\{\{[^{}]+\}\}/g;

/** Lê o cabeçalho salvo no bloco; `undefined` quando não há nada para mandar. */
export function parseMessageHeader(value: unknown): MessageHeader | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const fields = value as Record<string, unknown>;
  const type = fields.type;
  if (type === "text") {
    const text = typeof fields.text === "string" ? fields.text.trim() : "";
    return text ? { type, text } : undefined;
  }
  if (type === "image" || type === "video" || type === "document") {
    const mediaUrl = typeof fields.mediaUrl === "string" ? fields.mediaUrl.trim() : "";
    if (!mediaUrl) return undefined;
    return { type, mediaUrl, ...(typeof fields.fileName === "string" && fields.fileName.trim() ? { fileName: fields.fileName.trim() } : {}) };
  }
  return undefined;
}

/**
 * O que está errado no endereço do botão de link, ou `null`. A variável só pode vir depois do domínio (D-3): um dado do
 * cliente não pode mudar para qual site o botão leva.
 */
export function linkButtonUrlProblem(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Informe o endereço do botão.";
  if (!trimmed.toLowerCase().startsWith("https://")) return "O endereço precisa começar com https://.";
  const host = trimmed.slice("https://".length).split(/[/?#]/)[0] ?? "";
  if (host.includes("{")) return "Variável só pode entrar depois do domínio (ex.: https://site.com/{{nome}}).";
  try {
    const parsed = new URL(trimmed.replace(VARIABLE_TOKEN, "x"));
    if (!parsed.hostname.includes(".")) return "Endereço inválido.";
  } catch {
    return "Endereço inválido.";
  }
  return null;
}

/** Troca as variáveis do endereço pelo valor de cada uma, codificado para URL. */
export function fillLinkButtonUrl(url: string, fillText: (text: string) => string): string {
  return url.trim().replace(VARIABLE_TOKEN, (token) => encodeURIComponent(fillText(token).trim()));
}
