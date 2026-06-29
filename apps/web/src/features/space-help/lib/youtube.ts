export function parseYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0) return parts[embedIdx + 1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseVimeoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    return id ?? null;
  } catch {
    return null;
  }
}

export function videoEmbedUrl(url: string | null | undefined): string | null {
  const ytId = parseYoutubeId(url);
  if (ytId) return `https://www.youtube.com/embed/${ytId}`;
  const vmId = parseVimeoId(url);
  if (vmId) return `https://player.vimeo.com/video/${vmId}`;
  return null;
}

export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  return videoEmbedUrl(url);
}
