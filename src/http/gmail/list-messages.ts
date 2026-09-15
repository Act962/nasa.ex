import "server-only";

import { gmailFetch } from "./client";

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

interface GmailListMessagesResponse {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export async function listGmailMessages(params: {
  accessToken: string;
  query: string;
  maxResults: number;
}): Promise<GmailMessageRef[]> {
  const collected: GmailMessageRef[] = [];
  let pageToken: string | undefined;

  do {
    const page = await gmailFetch<GmailListMessagesResponse>("/messages", {
      accessToken: params.accessToken,
      searchParams: {
        q: params.query,
        maxResults: Math.min(100, params.maxResults - collected.length),
        pageToken,
      },
    });
    collected.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && collected.length < params.maxResults);

  return collected.slice(0, params.maxResults);
}
