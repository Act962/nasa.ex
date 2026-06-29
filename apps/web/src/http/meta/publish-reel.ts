const GRAPH_API = "https://graph.facebook.com/v19.0";

interface InstaReelParams {
  accessToken: string;
  instagramAccountId: string;
  videoUrl: string;
  caption?: string;
  coverUrl?: string;
}

async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`Reel container error: ${JSON.stringify(data)}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Timeout aguardando processamento do Reel");
}

export async function publishInstagramReel({
  accessToken,
  instagramAccountId,
  videoUrl,
  caption,
  coverUrl,
}: InstaReelParams) {
  // Step 1: create container
  const createRes = await fetch(`${GRAPH_API}/${instagramAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      ...(caption && { caption }),
      ...(coverUrl && { cover_url: coverUrl }),
      access_token: accessToken,
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    throw new Error(`Reel container create error: ${JSON.stringify(createData)}`);
  }
  const containerId = createData.id as string;

  // Step 2: wait for Meta to process the video
  await waitForContainerReady(accessToken, containerId);

  // Step 3: publish
  const publishRes = await fetch(`${GRAPH_API}/${instagramAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    throw new Error(`Reel publish error: ${JSON.stringify(publishData)}`);
  }
  return publishData.id as string;
}
