"use client";

import { cn } from "@/lib/utils";
import { PostCardDropdownMenu } from "./post-card-dropdown-menu";
import type { MenuAction } from "./types";
import { useNetworkConnectionStatus } from "../../hooks/use-network-status";

const S3_BASE = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL
  ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}`
  : "";

const NETWORK_COLORS: Record<string, string> = {
  INSTAGRAM: "#e1306c",
  FACEBOOK:  "#1877f2",
  TIKTOK:    "#010101",
  LINKEDIN:  "#0a66c2",
  YOUTUBE:   "#ff0000",
  TWITTER:   "#1da1f2",
};

interface Post {
  id: string;
  title: string | null;
  thumbnail: string | null;
  status: string;
  targetNetworks: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  type?: string | null;
  videoKey?: string | null;
  metricsReach?: number | null;
  metricsLikes?: number | null;
}

interface Props {
  post: Post;
  selected: boolean;
  onSelect: (post: Post) => void;
  onMenuAction?: (postId: string, action: MenuAction) => void;
}

export function PostsCalendarPostCard({ post, selected, onSelect, onMenuAction }: Props) {
  const { isConnected } = useNetworkConnectionStatus();
  const network = post.targetNetworks[0];
  const color = network ? (NETWORK_COLORS[network] ?? "#7c3aed") : "#7c3aed";
  const time = post.scheduledAt ?? post.publishedAt;

  return (
    <button
      type="button"
      onClick={() => onSelect(post)}
      className={cn(
        "group relative h-[52px] w-full overflow-hidden rounded-md transition text-left",
        selected ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/60",
      )}
      style={{ backgroundColor: color }}
      title={post.title ?? "Post"}
    >
      {post.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnail.startsWith("http") ? post.thumbnail : `${S3_BASE}/${post.thumbnail}`}
          alt={post.title ?? ""}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 pb-1 pt-4">
        <div className="truncate text-[9px] font-bold leading-tight text-white drop-shadow">
          {post.title ?? "Post"}
        </div>
        {time && (
          <div className="text-[8px] text-white/80">
            {new Date(time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        {post.status === "PUBLISHED" && (post.metricsReach != null || post.metricsLikes != null) && (
          <div className="text-[8px] text-emerald-300 font-semibold flex items-center gap-1.5">
            {post.metricsReach != null && <span>👁 {post.metricsReach >= 1000 ? `${(post.metricsReach / 1000).toFixed(1)}K` : post.metricsReach}</span>}
            {post.metricsLikes != null && <span>❤ {post.metricsLikes >= 1000 ? `${(post.metricsLikes / 1000).toFixed(1)}K` : post.metricsLikes}</span>}
          </div>
        )}
      </div>

      {/* Network badge with connection status */}
      {network && (
        <div className="absolute left-1 top-1 bg-black/60 text-white text-[7px] font-bold px-1 rounded backdrop-blur-sm flex items-center gap-0.5">
          <span className={`size-1.5 rounded-full shrink-0 ${isConnected(network) ? "bg-emerald-400" : "bg-zinc-500"}`} />
          {network}
        </div>
      )}

      {/* Status dot — hidden when dropdown is shown */}
      {!onMenuAction && (
        <div
          className={cn(
            "absolute right-1 top-1 size-2 rounded-full border border-white/40",
            post.status === "PUBLISHED" ? "bg-green-400" :
            post.status === "SCHEDULED" ? "bg-blue-400" :
            post.status === "APPROVED"  ? "bg-yellow-400" :
            "bg-gray-400",
          )}
          title={post.status}
        />
      )}

      {/* 3-dot dropdown */}
      {onMenuAction && (
        <PostCardDropdownMenu
          post={post}
          onAction={(action) => onMenuAction(post.id, action)}
        />
      )}
    </button>
  );
}
