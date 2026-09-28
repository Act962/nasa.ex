import "server-only";

import { gmailFetch } from "./client";

interface GmailAttachmentResponse {
  size: number;
  data: string;
}

export async function getGmailAttachmentBytes(params: {
  accessToken: string;
  messageId: string;
  attachmentId: string;
}): Promise<Buffer> {
  const attachment = await gmailFetch<GmailAttachmentResponse>(
    `/messages/${encodeURIComponent(params.messageId)}/attachments/${encodeURIComponent(params.attachmentId)}`,
    { accessToken: params.accessToken },
  );
  return Buffer.from(attachment.data, "base64url");
}
