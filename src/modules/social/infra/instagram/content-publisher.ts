import "server-only";
import {
  ContentPublishError,
  type ChannelCapabilities,
  type CommentOwnership,
  type ContentPublisher,
  type CredentialRenewal,
  type CredentialRenewer,
  type MediaContainerInput,
  type MediaContainerStatus,
  type PublishedComment,
  type PublishedCommentPage,
  type PublishedMediaMetrics,
} from "../../ports/content-publisher";

/**
 * Publicação no Instagram pela Graph API (spec 0071).
 *
 * As duas formas de conexão usam os mesmos caminhos e mudam só o host, o token
 * e o nó que envia a resposta privada: `graph.instagram.com` com o token do app
 * do Instagram, ou `graph.facebook.com` com o token de página da conexão da Meta.
 */

export const INSTAGRAM_LOGIN_GRAPH_URL = process.env.INSTAGRAM_BASE_URL ?? "https://graph.instagram.com/v21.0";
export const META_LOGIN_GRAPH_URL = process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com/v21.0";

const EXPIRED_TOKEN_CODE = 190;
const MISSING_CAPABILITY_CODE = 3;
const MISSING_PERMISSION_CODE = 10;
const COMMENT_FIELDS = "id,text,username,timestamp,hidden,like_count,from{id,username}";

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean };
};

type GraphCommentNode = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  hidden?: boolean;
  like_count?: number;
  from?: { id?: string; username?: string };
  replies?: { data?: GraphCommentNode[] };
};

interface GraphRequest {
  method?: "GET" | "POST" | "DELETE";
  payload?: Record<string, string | boolean>;
}

async function readGraphResponse<T>(response: Response): Promise<T> {
  const responseBody = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok || responseBody.error) {
    const graphError = responseBody.error ?? {};
    throw new ContentPublishError(
      graphError.message ?? `A rede respondeu ${response.status}`,
      graphError.code ?? null,
      graphError.error_subcode ?? null,
      Boolean(graphError.is_transient) || response.status >= 500,
    );
  }
  return responseBody;
}

function toContainerBody(input: MediaContainerInput): Record<string, string | boolean> {
  switch (input.kind) {
    case "IMAGE":
      return { image_url: input.imageUrl, ...(input.caption && { caption: input.caption }) };
    case "CAROUSEL_ITEM":
      return input.videoUrl
        ? { media_type: "VIDEO", video_url: input.videoUrl, is_carousel_item: true }
        : { image_url: input.imageUrl ?? "", is_carousel_item: true };
    case "CAROUSEL":
      return { media_type: "CAROUSEL", children: input.childrenIds.join(","), ...(input.caption && { caption: input.caption }) };
    case "REELS":
      return {
        media_type: "REELS",
        video_url: input.videoUrl,
        share_to_feed: input.shareToFeed ?? true,
        ...(input.caption && { caption: input.caption }),
        ...(input.coverUrl && { cover_url: input.coverUrl }),
      };
    case "STORIES":
      return input.videoUrl
        ? { media_type: "STORIES", video_url: input.videoUrl }
        : { media_type: "STORIES", image_url: input.imageUrl ?? "" };
  }
}

function toPublishedComment(node: GraphCommentNode): PublishedComment {
  return {
    id: node.id,
    text: node.text ?? "",
    username: node.username ?? node.from?.username ?? null,
    timestamp: node.timestamp ?? null,
    isHidden: Boolean(node.hidden),
    likeCount: node.like_count ?? 0,
    authorId: node.from?.id ?? null,
    replies: (node.replies?.data ?? []).map(toPublishedComment),
  };
}

function isPermissionError(error: ContentPublishError) {
  if (error.code === null) return false;
  return error.code === MISSING_CAPABILITY_CODE || error.code === MISSING_PERMISSION_CODE || (error.code >= 200 && error.code < 300);
}

export class InstagramContentPublisher implements ContentPublisher {
  constructor(
    private readonly baseUrl: string,
    private readonly accountId: string,
    private readonly accessToken: string,
    /** Nó que envia a resposta privada: a própria conta, ou a página na conexão da Meta. */
    private readonly privateReplySenderId: string,
  ) {}

  private async callGraph<T>(path: string, { method = "GET", payload }: GraphRequest = {}): Promise<T> {
    if (method === "POST") {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: this.accessToken }),
      });
      return readGraphResponse<T>(response);
    }
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${this.baseUrl}${path}${separator}access_token=${encodeURIComponent(this.accessToken)}`, { method });
    return readGraphResponse<T>(response);
  }

  async createMediaContainer(input: MediaContainerInput): Promise<string> {
    const created = await this.callGraph<{ id: string }>(`/${this.accountId}/media`, { method: "POST", payload: toContainerBody(input) });
    return created.id;
  }

  async getMediaContainerStatus(containerId: string): Promise<MediaContainerStatus> {
    const container = await this.callGraph<{ status_code?: string; status?: string }>(`/${containerId}?fields=status_code,status`);
    return { statusCode: container.status_code ?? "IN_PROGRESS", detail: container.status ?? null };
  }

  async publishMediaContainer(containerId: string): Promise<string> {
    const published = await this.callGraph<{ id: string }>(`/${this.accountId}/media_publish`, { method: "POST", payload: { creation_id: containerId } });
    return published.id;
  }

  async getMediaPermalink(mediaId: string): Promise<string | null> {
    try {
      const media = await this.callGraph<{ permalink?: string }>(`/${mediaId}?fields=permalink`);
      return media.permalink ?? null;
    } catch {
      return null;
    }
  }

  /** Insight indisponível vira null, nunca erro. */
  async getMediaMetrics(mediaId: string, isStory: boolean): Promise<PublishedMediaMetrics> {
    const fields = isStory ? "media_url,thumbnail_url" : "like_count,comments_count,media_url,thumbnail_url";
    const media = await this.callGraph<{ like_count?: number; comments_count?: number; media_url?: string; thumbnail_url?: string }>(`/${mediaId}?fields=${fields}`);

    const insightValues = new Map<string, number>();
    for (const metricList of ["reach,views", "reach"]) {
      try {
        const insights = await this.callGraph<{ data?: Array<{ name: string; values?: Array<{ value?: number }> }> }>(`/${mediaId}/insights?metric=${metricList}`);
        for (const metric of insights.data ?? []) {
          const value = metric.values?.[0]?.value;
          if (typeof value === "number") insightValues.set(metric.name, value);
        }
        break;
      } catch {
        // `views` não existe para todo tipo de mídia em toda versão; tenta só o alcance.
      }
    }

    return {
      likeCount: media.like_count ?? null,
      commentsCount: media.comments_count ?? null,
      mediaUrl: media.media_url ?? null,
      thumbnailUrl: media.thumbnail_url ?? null,
      reach: insightValues.get("reach") ?? null,
      views: insightValues.get("views") ?? null,
    };
  }

  async listMediaComments(mediaId: string, afterCursor?: string): Promise<PublishedCommentPage> {
    const query = new URLSearchParams({ fields: `${COMMENT_FIELDS},replies{${COMMENT_FIELDS}}`, limit: "20" });
    if (afterCursor) query.set("after", afterCursor);
    const page = await this.callGraph<{ data?: GraphCommentNode[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `/${mediaId}/comments?${query.toString()}`,
    );
    return {
      comments: (page.data ?? []).map(toPublishedComment),
      nextCursor: page.paging?.next ? (page.paging.cursors?.after ?? null) : null,
    };
  }

  /** A resposta pode vir sem `media`: sobe pelo comentário pai. */
  async getCommentOwnership(commentId: string): Promise<CommentOwnership> {
    const comment = await this.callGraph<{ media?: { id?: string }; parent_id?: string; from?: { id?: string } }>(
      `/${commentId}?fields=media{id},parent_id,from{id}`,
    );
    let mediaId = comment.media?.id ?? null;
    if (!mediaId && comment.parent_id) {
      const parent = await this.callGraph<{ media?: { id?: string } }>(`/${comment.parent_id}?fields=media{id}`);
      mediaId = parent.media?.id ?? null;
    }
    return { mediaId, parentId: comment.parent_id ?? null, authorId: comment.from?.id ?? null };
  }

  createMediaComment(mediaId: string, message: string) {
    return this.callGraph<{ id: string }>(`/${mediaId}/comments`, { method: "POST", payload: { message } });
  }

  replyToComment(commentId: string, message: string) {
    return this.callGraph<{ id: string }>(`/${commentId}/replies`, { method: "POST", payload: { message } });
  }

  /** Uma por comentário, até 7 dias depois. */
  async sendPrivateReply(commentId: string, text: string): Promise<void> {
    await this.callGraph<{ message_id?: string }>(`/${this.privateReplySenderId}/messages`, {
      method: "POST",
      payload: { recipient: JSON.stringify({ comment_id: commentId }), message: JSON.stringify({ text }) },
    });
  }

  async setCommentHidden(commentId: string, isHidden: boolean): Promise<void> {
    await this.callGraph<{ success?: boolean }>(`/${commentId}`, { method: "POST", payload: { hide: isHidden } });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.callGraph<{ success?: boolean }>(`/${commentId}`, { method: "DELETE" });
  }

  private async probe(path: string): Promise<"allowed" | "denied" | "rejected" | "unknown"> {
    try {
      await this.callGraph<unknown>(path);
      return "allowed";
    } catch (error) {
      if (!(error instanceof ContentPublishError)) return "unknown";
      if (error.code === EXPIRED_TOKEN_CODE) return "rejected";
      return isPermissionError(error) ? "denied" : "unknown";
    }
  }

  async checkCapabilities(): Promise<ChannelCapabilities> {
    const [publishProbe, insightsProbe] = await Promise.all([
      this.probe(`/${this.accountId}/content_publishing_limit?fields=quota_usage`),
      this.probe(`/${this.accountId}/insights?metric=reach&period=day`),
    ]);
    const toCapability = (probeResult: typeof publishProbe) => (probeResult === "allowed" ? true : probeResult === "denied" ? false : null);
    return {
      canPublish: toCapability(publishProbe),
      canReadInsights: toCapability(insightsProbe),
      isCredentialRejected: publishProbe === "rejected" || insightsProbe === "rejected",
    };
  }
}

/** Renovação do token de longa duração do app do Instagram (60 dias). Só aceita token com mais de 24h. */
export class InstagramLoginCredentialRenewer implements CredentialRenewer {
  constructor(private readonly graphOrigin: string = new URL(INSTAGRAM_LOGIN_GRAPH_URL).origin) {}

  async renew(accessToken: string): Promise<CredentialRenewal> {
    try {
      const response = await fetch(
        `${this.graphOrigin}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`,
      );
      const renewed = await readGraphResponse<{ access_token?: string; expires_in?: number }>(response);
      if (!renewed.access_token || !renewed.expires_in) {
        return { ok: false, error: "A rede não devolveu um token novo.", isCredentialRejected: false };
      }
      return { ok: true, accessToken: renewed.access_token, expiresAt: new Date(Date.now() + renewed.expires_in * 1000) };
    } catch (error) {
      const isCredentialRejected = error instanceof ContentPublishError && error.code === EXPIRED_TOKEN_CODE;
      return { ok: false, error: error instanceof Error ? error.message : "Falha ao renovar o token.", isCredentialRejected };
    }
  }
}
