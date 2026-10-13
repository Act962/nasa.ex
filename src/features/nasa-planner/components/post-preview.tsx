"use client";

import { useMemo } from "react";
import {
  HeartIcon,
  MessageCircleIcon,
  SendIcon,
  BookmarkIcon,
  MoreHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  MusicIcon,
} from "lucide-react";
import { useAvailableMetaAccounts } from "@/features/integrations/hooks/use-active-meta-account";
import { toPlannerMediaUrl } from "../lib/post-media";

const mediaUrl = toPlannerMediaUrl;

interface PostLike {
  type?: "STATIC" | "CAROUSEL" | "REEL" | "STORY" | string;
  caption?: string | null;
  hashtags?: string[];
  thumbnail?: string | null;
  videoKey?: string | null;
  slides?: Array<{ imageKey?: string | null; headline?: string | null }>;
  targetIgAccountId?: string | null;
  targetFbPageId?: string | null;
}

/** Post já publicado: mostra os números reais e a data em vez do rótulo de rascunho. */
interface PublishedDetails {
  handle?: string | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  publishedAt?: Date | string | null;
}

interface Props {
  post: PostLike;
  published?: PublishedDetails;
  /** Revisão antes de publicar: Reel em pé, com a capa, som e controles para assistir inteiro. */
  isReviewing?: boolean;
}

const formatCount = (count: number) => count.toLocaleString("pt-BR");

export function PostPreview({ post, published, isReviewing = false }: Props) {
  const { data } = useAvailableMetaAccounts();

  const igAccount = useMemo(
    () =>
      data?.igAccounts?.find((a) => a.id === post.targetIgAccountId) ?? null,
    [data, post.targetIgAccountId],
  );
  const fbPage = useMemo(
    () => data?.pages?.find((p) => p.id === post.targetFbPageId) ?? null,
    [data, post.targetFbPageId],
  );

  const handleLabel = published?.handle
    ? `@${published.handle}`
    : igAccount?.username
      ? `@${igAccount.username}`
      : igAccount?.name ?? fbPage?.name ?? "sua_conta";

  const initial = handleLabel.replace(/^@/, "").charAt(0).toUpperCase() || "•";

  const slides = (post.slides ?? []).filter((s) => s.imageKey);
  const isCarousel = post.type === "CAROUSEL" && slides.length > 1;
  const isReel = post.type === "REEL";
  const isStory = post.type === "STORY";

  const primaryMedia =
    mediaUrl(post.thumbnail) ?? mediaUrl(slides[0]?.imageKey);
  const videoUrl = mediaUrl(post.videoKey);
  // Vídeo importado com o formato errado (ex.: marcado como post estático) ainda precisa aparecer na prévia.
  const showsVideo = Boolean(videoUrl) && (isReel || !primaryMedia);

  const captionText = post.caption ?? "";
  const hashtagsText = (post.hashtags ?? []).map((hashtag) => `#${hashtag.replace(/^#/, "")}`).join(" ");

  return (
    <div className="w-full max-w-[300px] mx-auto bg-white dark:bg-zinc-950 rounded-[28px] border-2 border-border shadow-2xl overflow-hidden">
      {/* Phone notch */}
      <div className="h-5 bg-black flex items-center justify-center">
        <div className="w-14 h-1.5 rounded-full bg-zinc-700" />
      </div>

      {/* Screen */}
      <div className="bg-white dark:bg-zinc-950 max-h-[560px] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] shrink-0">
              <div className="w-full h-full rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                {initial}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{handleLabel}</p>
              {isReel ? (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MusicIcon className="size-2.5" /> Som original
                </p>
              ) : published ? null : (
                <p className="text-[10px] text-muted-foreground">Patrocinado</p>
              )}
            </div>
          </div>
          <MoreHorizontalIcon className="size-4 text-zinc-500 shrink-0" />
        </div>

        {/* Media */}
        <div className={`relative bg-zinc-100 dark:bg-zinc-900 ${isReviewing && showsVideo ? "aspect-[9/16]" : "aspect-square"}`}>
          {isReviewing && showsVideo ? (
            // "#t=0.1" faz o navegador desenhar o primeiro quadro quando ainda não há capa.
            <video src={primaryMedia ? videoUrl : `${videoUrl}#t=0.1`} poster={primaryMedia} className="w-full h-full object-cover" controls playsInline preload="metadata" />
          ) : showsVideo ? (
            <>
              <video
                src={videoUrl}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="size-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <PlayIcon className="size-6 text-white fill-white" />
                </div>
              </div>
            </>
          ) : primaryMedia ? (
            <img
              src={primaryMedia}
              alt="post"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem mídia
            </div>
          )}

          {isCarousel && (
            <>
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/55 text-white text-[10px] font-semibold">
                1/{slides.length}
              </div>
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <ChevronLeftIcon className="size-4 text-white drop-shadow ml-1 opacity-80" />
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                <ChevronRightIcon className="size-4 text-white drop-shadow mr-1 opacity-80" />
              </div>
            </>
          )}

          {isStory && (
            <div className="absolute top-2 left-2 right-2 flex gap-1">
              <div className="flex-1 h-0.5 bg-white rounded-full" />
              <div className="flex-1 h-0.5 bg-white/40 rounded-full" />
              <div className="flex-1 h-0.5 bg-white/40 rounded-full" />
            </div>
          )}
        </div>

        {/* Action bar — feed only */}
        {!isStory && (
          <div className="px-3 py-2 flex items-center gap-3">
            <HeartIcon className="size-5" />
            <MessageCircleIcon className="size-5" />
            <SendIcon className="size-5" />
            <BookmarkIcon className="size-5 ml-auto" />
          </div>
        )}

        {!isStory && published?.likeCount != null && (
          <p className="px-3 text-[11px] font-semibold">
            {formatCount(published.likeCount)} {published.likeCount === 1 ? "curtida" : "curtidas"}
          </p>
        )}

        {/* Caption */}
        {!isStory && (captionText || hashtagsText) && (
          <div className="px-3 pb-3 text-[11px] leading-relaxed">
            {captionText && (
              <p className="whitespace-pre-wrap line-clamp-4">
                <span className="font-semibold mr-1">{handleLabel}</span>
                {captionText}
              </p>
            )}
            {hashtagsText && (
              <p className="text-blue-500 mt-1 line-clamp-2">{hashtagsText}</p>
            )}
          </div>
        )}

        {!isStory && published && (
          <div className="px-3 pb-3 text-[11px]">
            {published.commentsCount != null && published.commentsCount > 0 && (
              <p className="text-muted-foreground">
                {published.commentsCount === 1 ? "Ver 1 comentário" : `Ver todos os ${formatCount(published.commentsCount)} comentários`}
              </p>
            )}
            {published.publishedAt && (
              <p className="mt-1 text-[9px] uppercase text-muted-foreground">
                {new Date(published.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="h-4 bg-black flex items-center justify-center">
        <div className="w-16 h-0.5 rounded-full bg-zinc-600" />
      </div>
    </div>
  );
}
