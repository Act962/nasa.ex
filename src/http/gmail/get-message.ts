import "server-only";

import { gmailFetch } from "./client";

interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailMessagePart[];
}

interface GmailRawMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

export interface GmailMessageAttachment {
  /** Estável entre leituras — o `attachmentId` do Gmail muda a cada GET. */
  partId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  receivedAt: Date;
  attachments: GmailMessageAttachment[];
}

function findHeader(part: GmailMessagePart | undefined, headerName: string): string {
  const header = part?.headers?.find(
    (candidate) => candidate.name.toLowerCase() === headerName.toLowerCase(),
  );
  return header?.value ?? "";
}

function parseFromHeader(rawFrom: string): { fromEmail: string; fromName: string | null } {
  const bracketMatch = rawFrom.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (bracketMatch) {
    const name = bracketMatch[1].trim();
    return { fromEmail: bracketMatch[2].trim().toLowerCase(), fromName: name || null };
  }
  return { fromEmail: rawFrom.trim().toLowerCase(), fromName: null };
}

function collectAttachments(
  part: GmailMessagePart | undefined,
  attachments: GmailMessageAttachment[],
) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) {
    attachments.push({
      partId: part.partId ?? part.filename,
      attachmentId: part.body.attachmentId,
      fileName: part.filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      sizeBytes: part.body.size ?? 0,
    });
  }
  for (const child of part.parts ?? []) collectAttachments(child, attachments);
}

export async function getGmailMessage(params: {
  accessToken: string;
  messageId: string;
}): Promise<GmailMessageSummary> {
  const message = await gmailFetch<GmailRawMessage>(
    `/messages/${encodeURIComponent(params.messageId)}`,
    { accessToken: params.accessToken, searchParams: { format: "full" } },
  );

  const attachments: GmailMessageAttachment[] = [];
  collectAttachments(message.payload, attachments);

  const internalDateMs = Number(message.internalDate ?? "");
  const headerDate = new Date(findHeader(message.payload, "Date"));
  const receivedAt = Number.isFinite(internalDateMs) && internalDateMs > 0
    ? new Date(internalDateMs)
    : Number.isNaN(headerDate.getTime())
      ? new Date()
      : headerDate;

  return {
    id: message.id,
    threadId: message.threadId,
    subject: findHeader(message.payload, "Subject") || "(sem assunto)",
    ...parseFromHeader(findHeader(message.payload, "From")),
    receivedAt,
    attachments,
  };
}
