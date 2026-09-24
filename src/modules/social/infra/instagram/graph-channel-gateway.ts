import "server-only";
import {
  MAX_BUTTON_TEMPLATE_CHARS,
  truncateToChars,
} from "../../domain/message-chunker";
import type { ContentRef, MessageButton, SocialContentTypeValue } from "../../domain/types";
import type {
  AccountProfile,
  ChannelGateway,
  ContentPage,
  DispatchResult,
  ReplyToCommentInput,
  SendDirectMessageInput,
} from "../../ports/channel-gateway";

const GRAPH_BASE_URL =
  process.env.INSTAGRAM_BASE_URL ?? "https://graph.instagram.com/v21.0";
const REQUEST_TIMEOUT_MS = Number(process.env.SOCIAL_REQUEST_TIMEOUT_MS ?? 10_000);

type GraphError = { error?: { message?: string; code?: number } };

function describeError(status: number, body: unknown): string {
  const graph = body as GraphError | null;
  if (graph?.error?.message) {
    return graph.error.code
      ? `[${graph.error.code}] ${graph.error.message}`
      : graph.error.message;
  }
  return `HTTP ${status}`;
}

function toContentType(mediaType?: string): SocialContentTypeValue {
  switch (mediaType) {
    case "IMAGE":
      return "IMAGE";
    case "VIDEO":
      return "VIDEO";
    case "CAROUSEL_ALBUM":
      return "CAROUSEL";
    case "REELS":
      return "REEL";
    default:
      return "OTHER";
  }
}

/**
 * Adapter do Instagram sobre a Graph API.
 *
 * É o único arquivo do módulo que sabe o formato da Meta. Trocar de rede
 * social é escrever outro destes — `domain/` e `application/` não mudam.
 */
export class InstagramGraphChannelGateway implements ChannelGateway {
  constructor(
    private readonly accountId: string,
    private readonly accessToken: string,
  ) {}

  private async request<T>(
    path: string,
    init?: { method?: "GET" | "POST"; body?: unknown },
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; authError: boolean }> {
    const url = `${GRAPH_BASE_URL}${path}`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? `Timeout de ${REQUEST_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : "Falha de rede";
      return { ok: false, error: message, authError: false };
    }

    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        ok: false,
        error: describeError(response.status, body),
        authError: response.status === 401 || response.status === 403,
      };
    }

    return { ok: true, data: body as T };
  }

  /**
   * A Meta distingue destinatário por `comment_id` (resposta privada, janela de
   * 7 dias a partir do comentário) e por `id` (DM comum, janela de 24h).
   */
  async sendDirectMessage(input: SendDirectMessageInput): Promise<DispatchResult> {
    const recipient = input.commentId
      ? { comment_id: input.commentId }
      : { id: input.externalUserId };

    const result = await this.request<{ message_id?: string }>(
      `/${this.accountId}/messages`,
      {
        method: "POST",
        body: {
          recipient,
          message: buildMessagePayload(input.text, input.buttons),
        },
      },
    );

    if (!result.ok) {
      return { ok: false, error: result.error, authError: result.authError };
    }
    return { ok: true, externalMessageId: result.data?.message_id };
  }

  async replyToComment(input: ReplyToCommentInput): Promise<DispatchResult> {
    const result = await this.request<{ id?: string }>(
      `/${input.commentId}/replies`,
      { method: "POST", body: { message: input.text } },
    );

    if (!result.ok) {
      return { ok: false, error: result.error, authError: result.authError };
    }
    return { ok: true, externalMessageId: result.data?.id };
  }

  async listContent(input: { cursor?: string }): Promise<ContentPage> {
    const fields = "id,caption,media_url,media_type,thumbnail_url,permalink,timestamp";
    const query = new URLSearchParams({ fields, limit: "24" });
    if (input.cursor) query.set("after", input.cursor);

    const result = await this.request<{
      data?: {
        id: string;
        caption?: string;
        media_url?: string;
        thumbnail_url?: string;
        media_type?: string;
        permalink?: string;
      }[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(`/${this.accountId}/media?${query.toString()}`);

    if (!result.ok) return { items: [] };

    const items: ContentRef[] = (result.data.data ?? []).map((media) => ({
      externalId: media.id,
      contentType: toContentType(media.media_type),
      caption: media.caption,
      mediaUrl: media.thumbnail_url ?? media.media_url,
      permalink: media.permalink,
    }));

    return {
      items,
      nextCursor: result.data.paging?.next
        ? result.data.paging.cursors?.after
        : undefined,
    };
  }

  /** Campos que este módulo consome hoje — ver `webhook-translator.ts`. */
  private static readonly SUBSCRIBED_FIELDS = "comments,messages";

  async subscribeToEvents(): Promise<DispatchResult> {
    const result = await this.request<{ success?: boolean }>(
      `/${this.accountId}/subscribed_apps?subscribed_fields=${InstagramGraphChannelGateway.SUBSCRIBED_FIELDS}`,
      { method: "POST" },
    );

    if (!result.ok) {
      return { ok: false, error: result.error, authError: result.authError };
    }
    return { ok: true };
  }

  async listSubscribedFields(): Promise<string[] | null> {
    const result = await this.request<{
      data?: { subscribed_fields?: string[] }[];
    }>(`/${this.accountId}/subscribed_apps`);

    if (!result.ok) return null;
    return result.data.data?.[0]?.subscribed_fields ?? [];
  }

  async fetchAccountProfile(): Promise<AccountProfile | null> {
    const result = await this.request<{
      user_id?: string;
      id?: string;
      username?: string;
      name?: string;
    }>(`/me?fields=user_id,username,name`);

    if (!result.ok) return null;

    const externalAccountId = result.data.user_id ?? result.data.id;
    if (!externalAccountId) return null;

    return {
      externalAccountId: String(externalAccountId),
      handle: result.data.username,
      displayName: result.data.name ?? result.data.username,
    };
  }
}

function buildMessagePayload(text: string, buttons?: MessageButton[]) {
  if (!buttons || buttons.length === 0) return { text };

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: truncateToChars(text, MAX_BUTTON_TEMPLATE_CHARS),
        buttons: buttons.slice(0, 3).map((button) => ({
          type: "web_url",
          url: button.url,
          title: button.title,
        })),
      },
    },
  };
}
