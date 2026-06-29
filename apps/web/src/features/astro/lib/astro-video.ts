/**
 * Payloads de vídeo renderizáveis pelo Astro.
 *
 * Quando uma tool quer mostrar vídeos (geralmente tutoriais do Space
 * Help), retorna `{ kind: "astro_videos", videos: [...] }`. O
 * `astro-message.tsx` detecta e renderiza um `<AstroVideoCardList>`
 * com thumbnails + título + duração — cada card é clicável.
 */

export interface AstroVideoCard {
  /** ID interno (usado como React key). */
  id: string;
  title: string;
  summary?: string | null;
  /**
   * URL do vídeo no YouTube (qualquer formato — short, watch, embed).
   * O renderer extrai o videoId pra montar a thumb.
   */
  youtubeUrl: string;
  /** Categoria/contexto (ex: "Forge", "Tracking"). */
  category?: string | null;
  /** Duração em minutos (mostrada no card como "X min"). */
  durationMin?: number | null;
  /**
   * Link interno do app pra abrir a página completa do tutorial
   * (com player embutido + passo-a-passo). Ex: "/space-help/forge/criar-proposta".
   * Se ausente, o card linka direto pro YouTube.
   */
  link?: string | null;
}

export interface AstroVideosPayload {
  kind: "astro_videos";
  /** Título da lista (ex: "Tutoriais sobre Forge"). */
  title?: string;
  /** Texto curto explicando o contexto. */
  caption?: string;
  videos: AstroVideoCard[];
}

export function isAstroVideosPayload(value: unknown): value is AstroVideosPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_videos" &&
    Array.isArray((value as { videos?: unknown }).videos)
  );
}

/**
 * Extrai o videoId de qualquer URL do YouTube.
 * Suporta:
 *   - https://youtube.com/watch?v=ABC123
 *   - https://www.youtube.com/watch?v=ABC123&t=10
 *   - https://youtu.be/ABC123
 *   - https://youtube.com/embed/ABC123
 *   - https://youtube.com/shorts/ABC123
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ?? null;
    }
    // youtube.com — várias variações
    if (u.hostname.includes("youtube.com")) {
      // /watch?v=<id>
      const v = u.searchParams.get("v");
      if (v) return v;
      // /embed/<id> | /shorts/<id> | /v/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "v") {
        return parts[1] ?? null;
      }
    }
    return null;
  } catch {
    // URL inválida — tenta regex como fallback
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return match?.[1] ?? null;
  }
}

/**
 * Constrói URL da thumbnail do YouTube. Usa `hqdefault` (não
 * `maxresdefault`) porque o último não existe pra todo vídeo
 * (especialmente uploads antigos / privados/unlisted recém-criados).
 */
export function youtubeThumbnail(url: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
