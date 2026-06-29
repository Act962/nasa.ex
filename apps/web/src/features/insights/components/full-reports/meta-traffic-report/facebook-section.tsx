"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  Facebook as FacebookIcon,
  Image as ImageIcon,
  Minus,
  Share2,
  Users,
} from "lucide-react";
import dayjs from "dayjs";

/**
 * Seção Facebook — KPIs da Page + Posts em destaque.
 *
 * Tudo via `metaAds.facebookOverview` (Graph API Pages Insights). Quando
 * não houver Page conectada, mostra estado vazio explicativo.
 */
interface Props {
  from: Date;
  to: Date;
}

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

function MiniKpi({
  label,
  value,
  Icon,
  loading,
}: {
  label: string;
  value: string;
  Icon: React.FC<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <Icon className="size-3" />
          <span className="truncate">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Minus className="size-3" /> período atual
        </span>
      </CardContent>
    </Card>
  );
}

function PostTile({
  post,
}: {
  post: {
    id: string;
    message: string | null;
    permalinkUrl: string | null;
    fullPicture: string | null;
    createdTime: string;
    likes: number;
    comments: number;
    shares: number;
  };
}) {
  const img = post.fullPicture;
  return (
    <a
      href={post.permalinkUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square block overflow-hidden rounded-md bg-muted"
      title={post.message ?? ""}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={post.message ?? "post"}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageIcon className="size-5 text-muted-foreground/40" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1.5 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        <span>👍 {fmtInt(post.likes)}</span>
        <span>💬 {fmtInt(post.comments)}</span>
        <span>↗️ {fmtInt(post.shares)}</span>
      </div>
      <div className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
        {dayjs(post.createdTime).format("DD/MM")}
      </div>
    </a>
  );
}

export function FacebookSection({ from, to }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.facebookOverview.queryOptions({
      input: {
        startDate: from.toISOString(),
        endDate: to.toISOString(),
        postsLimit: 6,
      },
    }),
  );

  const summary = data?.summary ?? null;
  const topPosts = data?.topPosts ?? [];
  const connected = data?.connected ?? false;

  if (!isLoading && !connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <FacebookIcon className="size-6 text-muted-foreground/50" />
          <p className="text-sm font-medium">Page Facebook não conectada</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Conecte uma Page do Facebook em Integrações pra ver seguidores,
            alcance da página e postagens em destaque.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi
          label="Seguidores da página"
          value={summary ? fmtInt(summary.followersCount) : "—"}
          Icon={Users}
          loading={isLoading}
        />
        <MiniKpi
          label="Novos seguidores"
          value={summary ? fmtInt(summary.newFollowers) : "—"}
          Icon={Users}
          loading={isLoading}
        />
        <MiniKpi
          label="Alcance total da página"
          value={summary ? fmtInt(summary.reachTotal) : "—"}
          Icon={Eye}
          loading={isLoading}
        />
        <MiniKpi
          label="Visualizações da página"
          value={summary ? fmtInt(summary.pageViews) : "—"}
          Icon={Eye}
          loading={isLoading}
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Postagens em destaque
            </h4>
            <Badge variant="outline" className="text-[10px]">
              Top {topPosts.length} por engajamento
            </Badge>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : topPosts.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Sem posts no período.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {topPosts.map((p) => (
                <PostTile key={p.id} post={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
