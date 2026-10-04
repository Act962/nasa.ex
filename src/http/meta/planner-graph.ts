/** Chamadas cruas da Graph API usadas pela publicação do Planner (spec 0057): um passo por função, erro tipado. */

const GRAPH_API = "https://graph.facebook.com/v21.0";

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly isTransient: boolean,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean };
};

interface GraphRequest {
  accessToken: string;
  method?: "GET" | "POST" | "DELETE";
  payload?: Record<string, string | boolean>;
}

async function callGraph<T>(path: string, { accessToken, method = "GET", payload }: GraphRequest): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const response =
    method === "GET" || method === "DELETE"
      ? await fetch(`${GRAPH_API}${path}${separator}access_token=${encodeURIComponent(accessToken)}`, { method })
      : await fetch(`${GRAPH_API}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, access_token: accessToken }),
        });
  const responseBody = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok || responseBody.error) {
    const graphError = responseBody.error ?? {};
    throw new MetaGraphError(
      graphError.message ?? `Graph API respondeu ${response.status}`,
      graphError.code ?? null,
      graphError.error_subcode ?? null,
      Boolean(graphError.is_transient) || response.status >= 500,
    );
  }
  return responseBody;
}

export type IgContainerParams =
  | { kind: "IMAGE"; imageUrl: string; caption?: string }
  | { kind: "CAROUSEL_ITEM"; imageUrl?: string; videoUrl?: string }
  | { kind: "CAROUSEL"; childrenIds: string[]; caption?: string }
  | { kind: "REELS"; videoUrl: string; caption?: string; coverUrl?: string; shareToFeed?: boolean }
  | { kind: "STORIES"; imageUrl?: string; videoUrl?: string };

function toContainerBody(params: IgContainerParams): Record<string, string | boolean> {
  switch (params.kind) {
    case "IMAGE":
      return { image_url: params.imageUrl, ...(params.caption && { caption: params.caption }) };
    case "CAROUSEL_ITEM":
      return params.videoUrl
        ? { media_type: "VIDEO", video_url: params.videoUrl, is_carousel_item: true }
        : { image_url: params.imageUrl ?? "", is_carousel_item: true };
    case "CAROUSEL":
      return { media_type: "CAROUSEL", children: params.childrenIds.join(","), ...(params.caption && { caption: params.caption }) };
    case "REELS":
      return {
        media_type: "REELS",
        video_url: params.videoUrl,
        share_to_feed: params.shareToFeed ?? true,
        ...(params.caption && { caption: params.caption }),
        ...(params.coverUrl && { cover_url: params.coverUrl }),
      };
    case "STORIES":
      return params.videoUrl
        ? { media_type: "STORIES", video_url: params.videoUrl }
        : { media_type: "STORIES", image_url: params.imageUrl ?? "" };
  }
}

export async function createIgContainer(accessToken: string, igUserId: string, params: IgContainerParams) {
  const created = await callGraph<{ id: string }>(`/${igUserId}/media`, {
    method: "POST",
    accessToken,
    payload: toContainerBody(params),
  });
  return created.id;
}

/** `FINISHED` libera a publicação; `IN_PROGRESS` pede nova checagem; `ERROR`/`EXPIRED` encerram. */
export async function getIgContainerStatus(accessToken: string, containerId: string) {
  const container = await callGraph<{ status_code?: string; status?: string }>(`/${containerId}?fields=status_code,status`, {
    accessToken,
  });
  return { statusCode: container.status_code ?? "IN_PROGRESS", detail: container.status ?? null };
}

export async function publishIgContainer(accessToken: string, igUserId: string, containerId: string) {
  const published = await callGraph<{ id: string }>(`/${igUserId}/media_publish`, {
    method: "POST",
    accessToken,
    payload: { creation_id: containerId },
  });
  return published.id;
}

export async function getIgMediaPermalink(accessToken: string, mediaId: string) {
  try {
    const media = await callGraph<{ permalink?: string }>(`/${mediaId}?fields=permalink`, { accessToken });
    return media.permalink ?? null;
  } catch {
    return null;
  }
}

export async function publishFbPagePhoto(accessToken: string, pageId: string, imageUrl: string, message?: string) {
  const created = await callGraph<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
    method: "POST",
    accessToken,
    payload: { url: imageUrl, ...(message && { message }) },
  });
  return created.post_id ?? created.id;
}

/** Envia um vídeo por URL pública ao upload resumível da Meta (Reels e Stories de página). */
async function uploadVideoByUrl(accessToken: string, uploadUrl: string, videoUrl: string) {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}`, file_url: videoUrl },
  });
  const responseBody = (await response.json().catch(() => ({}))) as GraphErrorBody & { success?: boolean };
  if (!response.ok || responseBody.error || responseBody.success === false) {
    const graphError = responseBody.error ?? {};
    throw new MetaGraphError(graphError.message ?? "A Meta recusou o envio do vídeo", graphError.code ?? null, graphError.error_subcode ?? null, response.status >= 500);
  }
}

type PageVideoEdge = "video_reels" | "video_stories";

/** Reel ou Story de vídeo na página: start → upload por URL → finish (publica). */
export async function publishFbPageVideo(accessToken: string, pageId: string, edge: PageVideoEdge, videoUrl: string, description?: string) {
  const started = await callGraph<{ video_id: string; upload_url: string }>(`/${pageId}/${edge}`, {
    method: "POST",
    accessToken,
    payload: { upload_phase: "start" },
  });
  await uploadVideoByUrl(accessToken, started.upload_url, videoUrl);
  const finished = await callGraph<{ success?: boolean; post_id?: string }>(`/${pageId}/${edge}`, {
    method: "POST",
    accessToken,
    payload: {
      upload_phase: "finish",
      video_id: started.video_id,
      ...(edge === "video_reels" && { video_state: "PUBLISHED", ...(description && { description }) }),
    },
  });
  return finished.post_id ?? started.video_id;
}

/** Story de foto na página: sobe a foto sem publicar e a usa no Story. */
export async function publishFbPagePhotoStory(accessToken: string, pageId: string, imageUrl: string) {
  const uploaded = await callGraph<{ id: string }>(`/${pageId}/photos`, {
    method: "POST",
    accessToken,
    payload: { url: imageUrl, published: false },
  });
  const story = await callGraph<{ success?: boolean; post_id?: string }>(`/${pageId}/photo_stories`, {
    method: "POST",
    accessToken,
    payload: { photo_id: uploaded.id },
  });
  return story.post_id ?? uploaded.id;
}

/** Saúde da conta: uma leitura barata do próprio objeto com o token salvo. */
export async function pingGraphObject(accessToken: string, objectId: string) {
  await callGraph<{ id: string }>(`/${objectId}?fields=id`, { accessToken });
}

export type GraphPageWithInstagram = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
};

/** Páginas do usuário com o token de cada uma (backfill das contas de publicação). */
export async function listUserPagesWithTokens(userAccessToken: string) {
  const pages = await callGraph<{ data: GraphPageWithInstagram[] }>(
    "/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&limit=100",
    { accessToken: userAccessToken },
  );
  return pages.data ?? [];
}

export type IgMediaMetrics = {
  likeCount: number | null;
  commentsCount: number | null;
  reach: number | null;
  views: number | null;
  /** Mídia como está no Instagram (URL do CDN da Meta, expira em horas). */
  mediaUrl: string | null;
  thumbnailUrl: string | null;
};

/** Números de um post publicado (curtidas, comentários, alcance, visualizações). Insight indisponível vira null, nunca erro. */
export async function getIgMediaMetrics(accessToken: string, mediaId: string, isStory: boolean): Promise<IgMediaMetrics> {
  const fields = isStory ? "media_url,thumbnail_url" : "like_count,comments_count,media_url,thumbnail_url";
  const media = await callGraph<{ like_count?: number; comments_count?: number; media_url?: string; thumbnail_url?: string }>(
    `/${mediaId}?fields=${fields}`,
    { accessToken },
  );

  const insightValues = new Map<string, number>();
  for (const metricList of ["reach,views", "reach"]) {
    try {
      const insights = await callGraph<{ data?: Array<{ name: string; values?: Array<{ value?: number }> }> }>(
        `/${mediaId}/insights?metric=${metricList}`,
        { accessToken },
      );
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

export type IgCommentNode = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  hidden?: boolean;
  like_count?: number;
  from?: { id?: string; username?: string };
  replies?: { data?: IgCommentNode[] };
};

const COMMENT_FIELDS = "id,text,username,timestamp,hidden,like_count,from{id,username}";

/** Comentários de um post do Instagram, com as respostas de cada um. */
export async function listIgMediaComments(accessToken: string, mediaId: string, after?: string) {
  const query = new URLSearchParams({ fields: `${COMMENT_FIELDS},replies{${COMMENT_FIELDS}}`, limit: "20" });
  if (after) query.set("after", after);
  return callGraph<{ data?: IgCommentNode[]; paging?: { cursors?: { after?: string }; next?: string } }>(
    `/${mediaId}/comments?${query.toString()}`,
    { accessToken },
  );
}

/** Post, autor e comentário pai — confere que a ação mira o post certo. Resposta pode vir sem `media`: sobe pelo pai. */
export async function getIgCommentOwnership(accessToken: string, commentId: string) {
  const comment = await callGraph<{ media?: { id?: string }; parent_id?: string; from?: { id?: string } }>(
    `/${commentId}?fields=media{id},parent_id,from{id}`,
    { accessToken },
  );
  let mediaId = comment.media?.id ?? null;
  if (!mediaId && comment.parent_id) {
    const parent = await callGraph<{ media?: { id?: string } }>(`/${comment.parent_id}?fields=media{id}`, { accessToken });
    mediaId = parent.media?.id ?? null;
  }
  return { mediaId, parentId: comment.parent_id ?? null, authorId: comment.from?.id ?? null };
}

export async function createIgMediaComment(accessToken: string, mediaId: string, message: string) {
  return callGraph<{ id: string }>(`/${mediaId}/comments`, { accessToken, method: "POST", payload: { message } });
}

export async function replyToIgComment(accessToken: string, commentId: string, message: string) {
  return callGraph<{ id: string }>(`/${commentId}/replies`, { accessToken, method: "POST", payload: { message } });
}

/** Resposta privada ao autor do comentário (1 por comentário, até 7 dias depois). */
export async function sendIgPrivateReply(accessToken: string, pageId: string, commentId: string, text: string) {
  return callGraph<{ message_id?: string }>(`/${pageId}/messages`, {
    accessToken,
    method: "POST",
    payload: { recipient: JSON.stringify({ comment_id: commentId }), message: JSON.stringify({ text }) },
  });
}

export async function setIgCommentHidden(accessToken: string, commentId: string, isHidden: boolean) {
  return callGraph<{ success?: boolean }>(`/${commentId}`, { accessToken, method: "POST", payload: { hide: isHidden } });
}

export async function deleteIgComment(accessToken: string, commentId: string) {
  return callGraph<{ success?: boolean }>(`/${commentId}`, { accessToken, method: "DELETE" });
}
