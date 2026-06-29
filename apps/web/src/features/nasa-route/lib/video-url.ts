export type VideoProvider = "youtube" | "vimeo";

export interface ParsedVideo {
  provider: VideoProvider | null;
  videoId: string | null;
  embedUrl: string | null;
}

const YT_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
const VIMEO_RE_1 = /vimeo\.com\/(?:video\/)?(\d+)/;
const VIMEO_RE_2 = /player\.vimeo\.com\/video\/(\d+)/;

export function parseVideoUrl(url: string | null | undefined): ParsedVideo {
  if (!url) return { provider: null, videoId: null, embedUrl: null };

  const yt = url.match(YT_RE);
  if (yt) {
    const id = yt[1]!;
    return {
      provider: "youtube",
      videoId: id,
      embedUrl: `https://www.youtube.com/embed/${id}`,
    };
  }

  const vimeo = url.match(VIMEO_RE_1) ?? url.match(VIMEO_RE_2);
  if (vimeo) {
    const id = vimeo[1]!;
    return {
      provider: "vimeo",
      videoId: id,
      embedUrl: `https://player.vimeo.com/video/${id}`,
    };
  }

  return { provider: null, videoId: null, embedUrl: null };
}
