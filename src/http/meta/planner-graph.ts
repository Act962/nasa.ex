/** Chamadas cruas da Graph API para páginas do Facebook no Planner (spec 0057). Instagram publica pelo módulo social (spec 0071). */

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
