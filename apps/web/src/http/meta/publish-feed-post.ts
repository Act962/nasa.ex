const GRAPH_API = "https://graph.facebook.com/v19.0";

// ─── Instagram Feed (imagem única ou carrossel) ────────────────────────────────

interface InstaImageParams {
  accessToken: string;
  instagramAccountId: string;
  imageUrl: string;
  caption?: string;
}

interface InstaCarouselParams {
  accessToken: string;
  instagramAccountId: string;
  imageUrls: string[];
  caption?: string;
}

async function createInstaContainer(
  accessToken: string,
  instagramAccountId: string,
  params: Record<string, string>,
): Promise<string> {
  const res = await fetch(`${GRAPH_API}/${instagramAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`Instagram container error: ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function publishInstaContainer(
  accessToken: string,
  instagramAccountId: string,
  creationId: string,
): Promise<string> {
  const res = await fetch(`${GRAPH_API}/${instagramAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`Instagram publish error: ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

export async function publishInstagramImage({ accessToken, instagramAccountId, imageUrl, caption }: InstaImageParams) {
  const containerId = await createInstaContainer(accessToken, instagramAccountId, {
    image_url: imageUrl,
    ...(caption && { caption }),
  });
  return publishInstaContainer(accessToken, instagramAccountId, containerId);
}

export async function publishInstagramCarousel({ accessToken, instagramAccountId, imageUrls, caption }: InstaCarouselParams) {
  // Create individual item containers
  const itemIds = await Promise.all(
    imageUrls.map((url) =>
      createInstaContainer(accessToken, instagramAccountId, { image_url: url, is_carousel_item: "true" }),
    ),
  );

  // Create carousel container
  const carouselId = await createInstaContainer(accessToken, instagramAccountId, {
    media_type: "CAROUSEL",
    children: itemIds.join(","),
    ...(caption && { caption }),
  });

  return publishInstaContainer(accessToken, instagramAccountId, carouselId);
}

// ─── Facebook Page ─────────────────────────────────────────────────────────────

interface FbPagePostParams {
  accessToken: string;
  pageId: string;
  imageUrl: string;
  message?: string;
}

export async function publishFacebookPagePhoto({ accessToken, pageId, imageUrl, message }: FbPagePostParams) {
  const res = await fetch(`${GRAPH_API}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      ...(message && { message }),
      access_token: accessToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Facebook photo error: ${JSON.stringify(data)}`);
  return data as { id: string; post_id?: string };
}
