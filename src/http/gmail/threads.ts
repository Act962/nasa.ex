import "server-only";

import { gmailFetch } from "./client";

/**
 * Threads do Gmail para o canal E-mail do Tracking Chat (spec 0030): listar
 * conversas, ler uma conversa inteira com corpo em texto e responder.
 */

interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailRawThreadMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
}

interface GmailRawThread {
  id: string;
  snippet?: string;
  messages?: GmailRawThreadMessage[];
}

export interface GmailAddress {
  email: string;
  name: string | null;
}

export interface GmailThreadMessage {
  id: string;
  from: GmailAddress;
  to: GmailAddress[];
  subject: string;
  sentAt: Date;
  /** Corpo em texto puro — HTML é convertido, nunca devolvido cru (RNF-2). */
  bodyText: string;
  /** Cabeçalho `Message-ID`, para a resposta entrar na mesma conversa. */
  rfcMessageId: string;
  references: string;
}

export interface GmailThreadSummary {
  threadId: string;
  subject: string;
  snippet: string;
  lastMessageAt: Date;
  participants: GmailAddress[];
  messageCount: number;
  /** Quem mandou a última mensagem — decide se a conversa espera resposta. */
  lastFrom: GmailAddress;
}

function readHeader(part: GmailPart | undefined, name: string): string {
  const header = part?.headers?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

export function parseAddress(raw: string): GmailAddress {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { email: match[2]!.trim().toLowerCase(), name: match[1]!.trim() || null };
  }
  return { email: raw.trim().toLowerCase(), name: null };
}

function parseAddressList(raw: string): GmailAddress[] {
  if (!raw.trim()) return [];
  // Vírgula fora de aspas separa endereços.
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((chunk) => parseAddress(chunk))
    .filter((address) => address.email.includes("@"));
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function findPart(part: GmailPart | undefined, mimeType: string): GmailPart | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data && !part.filename) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return undefined;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

/** HTML → texto legível: sem tags, com quebras onde havia bloco (CB-5). */
function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBodyText(payload: GmailPart | undefined): string {
  const plainPart = findPart(payload, "text/plain");
  if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data).trim();
  const htmlPart = findPart(payload, "text/html");
  if (htmlPart?.body?.data) return htmlToText(decodeBase64Url(htmlPart.body.data));
  // Mensagem simples, sem partes.
  if (payload?.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? htmlToText(decoded) : decoded.trim();
  }
  return "";
}

function toThreadMessage(message: GmailRawThreadMessage): GmailThreadMessage {
  const payload = message.payload;
  return {
    id: message.id,
    from: parseAddress(readHeader(payload, "From")),
    to: parseAddressList(`${readHeader(payload, "To")},${readHeader(payload, "Cc")}`),
    subject: readHeader(payload, "Subject") || "(sem assunto)",
    sentAt: new Date(Number(message.internalDate ?? Date.now())),
    bodyText: extractBodyText(payload),
    rfcMessageId: readHeader(payload, "Message-ID") || readHeader(payload, "Message-Id"),
    references: readHeader(payload, "References"),
  };
}

export async function listGmailThreads(params: {
  accessToken: string;
  query: string;
  maxResults: number;
}): Promise<GmailThreadSummary[]> {
  const list = await gmailFetch<{ threads?: Array<{ id: string; snippet?: string }> }>(
    "/threads",
    {
      accessToken: params.accessToken,
      searchParams: { q: params.query, maxResults: params.maxResults },
    },
  );

  const threads = await Promise.all(
    (list.threads ?? []).map((thread) =>
      gmailFetch<GmailRawThread>(`/threads/${encodeURIComponent(thread.id)}`, {
        accessToken: params.accessToken,
        searchParams: { format: "metadata" },
      }),
    ),
  );

  return threads.map((thread) => {
    const messages = thread.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    const firstMessage = messages[0];
    const participants = new Map<string, GmailAddress>();
    for (const message of messages) {
      const from = parseAddress(readHeader(message.payload, "From"));
      if (from.email) participants.set(from.email, from);
      for (const address of parseAddressList(readHeader(message.payload, "To"))) {
        if (!participants.has(address.email)) participants.set(address.email, address);
      }
    }
    return {
      threadId: thread.id,
      subject: readHeader(firstMessage?.payload, "Subject") || "(sem assunto)",
      // O Gmail devolve o trecho com entidades HTML (`&#39;`).
      snippet: decodeHtmlEntities(lastMessage?.snippet ?? thread.snippet ?? ""),
      lastMessageAt: new Date(Number(lastMessage?.internalDate ?? Date.now())),
      participants: [...participants.values()],
      messageCount: messages.length,
      lastFrom: parseAddress(readHeader(lastMessage?.payload, "From")),
    };
  });
}

export async function getGmailThread(params: {
  accessToken: string;
  threadId: string;
}): Promise<GmailThreadMessage[]> {
  const thread = await gmailFetch<GmailRawThread>(
    `/threads/${encodeURIComponent(params.threadId)}`,
    { accessToken: params.accessToken, searchParams: { format: "full" } },
  );
  return (thread.messages ?? []).map(toThreadMessage);
}

/** Cabeçalho com acento precisa de encoded-word (RFC 2047). */
function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/** Corpo em base64 com linhas de 76 caracteres, como pede a RFC 2045. */
function encodeMimeBody(value: string): string {
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Envia um e-mail pela conta Gmail conectada. Com `threadId` e
 * `inReplyTo`, o Gmail e o cliente do lead mostram como resposta da mesma
 * conversa.
 */
export async function sendGmailMessage(params: {
  accessToken: string;
  to: GmailAddress;
  subject: string;
  htmlBody: string;
  textBody: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ id: string; threadId: string }> {
  const boundary = `orbita-${Date.now().toString(36)}`;
  const toHeader = params.to.name
    ? `${encodeHeaderValue(params.to.name)} <${params.to.email}>`
    : params.to.email;

  const headers = [
    `To: ${toHeader}`,
    `Subject: ${encodeHeaderValue(params.subject)}`,
    "MIME-Version: 1.0",
    ...(params.inReplyTo ? [`In-Reply-To: ${params.inReplyTo}`] : []),
    ...(params.inReplyTo || params.references
      ? [`References: ${[params.references, params.inReplyTo].filter(Boolean).join(" ")}`]
      : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const mime = [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(params.textBody),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(params.htmlBody),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return gmailFetch<{ id: string; threadId: string }>("/messages/send", {
    accessToken: params.accessToken,
    method: "POST",
    jsonBody: {
      raw: encodeBase64Url(mime),
      ...(params.threadId ? { threadId: params.threadId } : {}),
    },
  });
}
