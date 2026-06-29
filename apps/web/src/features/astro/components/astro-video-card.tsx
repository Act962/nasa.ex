"use client";

import Link from "next/link";
import { PlayCircleIcon, ClockIcon } from "lucide-react";
import {
  youtubeThumbnail,
  type AstroVideoCard,
  type AstroVideosPayload,
} from "@/features/astro/lib/astro-video";

/**
 * Lista de cards de vídeo renderizada dentro das mensagens do Astro
 * quando uma tool retorna `{ kind: "astro_videos", videos: [...] }`.
 *
 * Cada card mostra:
 *  - Thumbnail do YouTube (hqdefault) com ícone de play sobreposto.
 *  - Título + categoria + duração.
 *  - Link clicável: prefere a página interna (/space-help/...) que
 *    tem o player + steps; se não tiver, abre o YouTube direto.
 */
export function AstroVideoCardList({ payload }: { payload: AstroVideosPayload }) {
  if (payload.videos.length === 0) {
    return (
      <div className="w-full rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
        {payload.caption ?? "Nenhum tutorial encontrado."}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {(payload.title || payload.caption) && (
        <div className="px-1">
          {payload.title && (
            <div className="text-xs font-semibold text-zinc-300">
              {payload.title}
            </div>
          )}
          {payload.caption && (
            <div className="text-[11px] text-zinc-500">{payload.caption}</div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {payload.videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: AstroVideoCard }) {
  // Prefere link interno do app — tem player + steps + recompensas.
  // Cai pro YouTube direto se não houver link interno.
  const href = video.link ?? video.youtubeUrl;
  const thumb = youtubeThumbnail(video.youtubeUrl);

  return (
    <Link
      href={href}
      target={video.link ? undefined : "_blank"}
      rel={video.link ? undefined : "noopener noreferrer"}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/40 transition-colors hover:border-zinc-700 hover:bg-zinc-800/40"
    >
      <div className="relative aspect-video bg-zinc-900">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <PlayCircleIcon className="size-10 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <PlayCircleIcon className="size-10 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
        </div>
        {video.durationMin !== null && video.durationMin !== undefined && (
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <ClockIcon className="size-3" />
            {video.durationMin} min
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2.5 py-2">
        <div className="line-clamp-2 text-xs font-medium text-zinc-200 group-hover:text-white">
          {video.title}
        </div>
        {video.category && (
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            {video.category}
          </div>
        )}
        {video.summary && (
          <div className="line-clamp-2 text-[11px] text-zinc-400">
            {video.summary}
          </div>
        )}
      </div>
    </Link>
  );
}
