import type { NasaPlannerPostType } from "@/generated/prisma/enums";

/** Regras de formato da Meta checadas antes de programar (spec 0057, RF-11). Mesma função no criador, no agendamento e no MCP. */

const MAX_CAPTION_CHARS = 2200;
const MAX_HASHTAGS = 30;
const MIN_CAROUSEL_ITEMS = 2;
const MAX_CAROUSEL_ITEMS = 10;
const STORY_MAX_VIDEO_SECONDS = 60;
const REEL_MIN_VIDEO_SECONDS = 3;
const REEL_MAX_VIDEO_SECONDS = 15 * 60;

export interface PostToValidate {
  type: NasaPlannerPostType;
  caption: string | null;
  hashtags: string[];
  thumbnail: string | null;
  videoKey: string | null;
  videoDuration: number | null;
  targetNetworks: string[];
  slides: Array<{ imageKey: string | null; videoKey: string | null }>;
}

export function validatePostForPublishing(post: PostToValidate): string[] {
  const problems: string[] = [];
  const captionText = `${post.caption ?? ""} ${post.hashtags.map((hashtag) => `#${hashtag.replace(/^#/, "")}`).join(" ")}`.trim();

  if (post.targetNetworks.length === 0) problems.push("Escolha onde publicar (Instagram e/ou Facebook).");
  if (captionText.length > MAX_CAPTION_CHARS) problems.push(`A legenda passa de ${MAX_CAPTION_CHARS} caracteres.`);
  if ((captionText.match(/#\w+/g) ?? []).length > MAX_HASHTAGS) problems.push(`Use no máximo ${MAX_HASHTAGS} hashtags.`);

  const slideMedia = post.slides.filter((slide) => slide.imageKey || slide.videoKey);
  switch (post.type) {
    case "STORY":
      if (!post.thumbnail && !post.videoKey && slideMedia.length === 0) problems.push("O Story precisa de uma imagem ou um vídeo.");
      if (post.videoKey && post.videoDuration && post.videoDuration > STORY_MAX_VIDEO_SECONDS) {
        problems.push(`Vídeo de Story deve ter até ${STORY_MAX_VIDEO_SECONDS} segundos.`);
      }
      break;
    case "REEL":
      if (!post.videoKey) problems.push("O Reel precisa de um vídeo.");
      if (post.videoDuration && (post.videoDuration < REEL_MIN_VIDEO_SECONDS || post.videoDuration > REEL_MAX_VIDEO_SECONDS)) {
        problems.push("O vídeo do Reel deve ter entre 3 segundos e 15 minutos.");
      }
      break;
    case "CAROUSEL":
      if (slideMedia.length < MIN_CAROUSEL_ITEMS || slideMedia.length > MAX_CAROUSEL_ITEMS) {
        problems.push(`O carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.`);
      }
      break;
    default:
      if (!post.thumbnail) problems.push("O post precisa de uma imagem.");
  }
  return problems;
}
