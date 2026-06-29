"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  Heart,
  Instagram as InstagramIcon,
  Image as ImageIcon,
  Minus,
  UserSquare,
  Video,
} from "lucide-react";

/**
 * Seção Instagram Business — KPIs + Posts em destaque + Reels em destaque.
 *
 * Tudo via `metaAds.instagramOverview` (Instagram Graph API). Quando o user
 * ainda não conectou ou a Page não tem IG Business linkado, mostramos um
 * estado vazio explicativo sem quebrar.
 */
interface Props {
  from: Date;
  to: Date;
}

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number, d = 2) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v)}%`;

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

function MediaTile({
  media,
  isReel,
}: {
  media: {
    id: string;
    caption: string | null;
    mediaUrl: string | null;
    thumbnailUrl: string | null;
    permalink: string | null;
    likeCount: number;
    commentsCount: number;
    viewsCount: number;
  };
  isReel?: boolean;
}) {
  const img = media.thumbnailUrl ?? media.mediaUrl;
  const aspect = isReel ? "aspect-[9/16]" : "aspect-square";
  return (
    <a
      href={media.permalink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative ${aspect} block overflow-hidden rounded-md bg-muted`}
      title={media.caption ?? ""}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={media.caption ?? "media"}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          {isReel ? (
            <Video className="size-5 text-muted-foreground/40" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground/40" />
          )}
        </div>
      )}
      {/* Overlay com counts */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1.5 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-0.5">
          <Heart className="size-2.5" /> {fmtInt(media.likeCount)}
        </span>
        {isReel && (
          <span className="flex items-center gap-0.5">
            <Eye className="size-2.5" /> {fmtInt(media.viewsCount)}
          </span>
        )}
      </div>
    </a>
  );
}

export function InstagramSection({ from, to }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.instagramOverview.queryOptions({
      input: {
        startDate: from.toISOString(),
        endDate: to.toISOString(),
        mediaLimit: 6,
      },
    }),
  );

  const summary = data?.summary ?? null;
  const topMedia = data?.topMedia ?? [];
  const topReels = data?.topReels ?? [];
  const connected = data?.connected ?? false;

  if (!isLoading && !connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <InstagramIcon className="size-6 text-muted-foreground/50" />
          <p className="text-sm font-medium">Instagram Business não conectado</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Conecte uma Page do Facebook que tenha Instagram Business linkado em
            Integrações pra ver alcance, posts e Reels em destaque.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* 4 KPIs no topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi
          label="Seguidores"
          value={summary ? fmtInt(summary.followersCount) : "—"}
          Icon={InstagramIcon}
          loading={isLoading}
        />
        <MiniKpi
          label="Visualizações totais"
          value={summary ? fmtInt(summary.totalViews) : "—"}
          Icon={Eye}
          loading={isLoading}
        />
        <MiniKpi
          label="Salvamentos"
          value={summary ? fmtInt(summary.savedTotal) : "—"}
          Icon={Heart}
          loading={isLoading}
        />
        <MiniKpi
          label="Taxa de interação Reels"
          value={summary ? fmtPct(summary.reelsInteractionRate) : "—"}
          Icon={Video}
          loading={isLoading}
        />
      </div>
      {/* Mais 1 KPI: visitas perfil */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi
          label="Alcance total"
          value={summary ? fmtInt(summary.reachTotal) : "—"}
          Icon={Eye}
          loading={isLoading}
        />
        <MiniKpi
          label="Visitas do perfil"
          value={summary ? fmtInt(summary.profileViews) : "—"}
          Icon={UserSquare}
          loading={isLoading}
        />
      </div>

      {/* Posts em destaque */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Postagens em destaque
            </h4>
            <Badge variant="outline" className="text-[10px]">
              Top {topMedia.length} por engajamento
            </Badge>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : topMedia.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Sem posts no período.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {topMedia.map((m) => (
                <MediaTile key={m.id} media={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reels em destaque */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reels em destaque
            </h4>
            <Badge variant="outline" className="text-[10px]">
              Top {topReels.length} por engajamento
            </Badge>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[9/16] rounded-md" />
              ))}
            </div>
          ) : topReels.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Sem Reels no período.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {topReels.map((m) => (
                <MediaTile key={m.id} media={m} isReel />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
