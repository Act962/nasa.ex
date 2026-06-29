"use client";

import { EyeIcon, HeartIcon, MessageCircleIcon, Share2Icon, PlayIcon, UsersIcon } from "lucide-react";

interface Props {
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  videoViews?: number | null;
  size?: "sm" | "md";
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export function PostMetricsRow({ reach, impressions, likes, comments, shares, videoViews, size = "sm" }: Props) {
  const hasAny =
    reach != null || impressions != null || likes != null ||
    comments != null || shares != null || videoViews != null;
  if (!hasAny) return null;

  const cls = size === "sm" ? "text-[10px] gap-2" : "text-xs gap-3";
  const icon = size === "sm" ? "size-3" : "size-3.5";

  return (
    <div className={`flex items-center flex-wrap text-muted-foreground ${cls}`}>
      {reach != null && (
        <span className="flex items-center gap-0.5" title="Alcance">
          <UsersIcon className={icon} />{fmt(reach)}
        </span>
      )}
      {impressions != null && (
        <span className="flex items-center gap-0.5" title="Impressões">
          <EyeIcon className={icon} />{fmt(impressions)}
        </span>
      )}
      {videoViews != null && (
        <span className="flex items-center gap-0.5" title="Visualizações de vídeo">
          <PlayIcon className={icon} />{fmt(videoViews)}
        </span>
      )}
      {likes != null && (
        <span className="flex items-center gap-0.5" title="Curtidas">
          <HeartIcon className={icon} />{fmt(likes)}
        </span>
      )}
      {comments != null && (
        <span className="flex items-center gap-0.5" title="Comentários">
          <MessageCircleIcon className={icon} />{fmt(comments)}
        </span>
      )}
      {shares != null && (
        <span className="flex items-center gap-0.5" title="Compartilhamentos">
          <Share2Icon className={icon} />{fmt(shares)}
        </span>
      )}
    </div>
  );
}
