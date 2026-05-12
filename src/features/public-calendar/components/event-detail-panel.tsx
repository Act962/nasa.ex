"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ArrowRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EVENT_CATEGORIES } from "../utils/categories";
import { imgSrc } from "../utils/img-src";
import { EventBadges } from "./event-badges";
import { LikeButton } from "./like-button";
import { ShareButtons } from "./share-buttons";
import { Visualizometro } from "./visualizometro";
import { RichDescription } from "./rich-description";
import { ImageLightbox } from "./image-lightbox";
import type { PublicEvent } from "../types";

dayjs.locale("pt-br");

interface EventDetailPanelProps {
  event: PublicEvent;
  isLiked?: boolean;
  showFullCTA?: boolean;
  /** Permite renderizar o botão "Editar no Workspace" pra criador/owner. */
  canEdit?: boolean;
  /** Workspace ID do evento — usado pelo botão "Editar no Workspace". */
  workspaceId?: string | null;
}

export function EventDetailPanel({
  event,
  isLiked = false,
  showFullCTA,
  canEdit,
  workspaceId,
}: EventDetailPanelProps) {
  const category = event.eventCategory
    ? EVENT_CATEGORIES.find((c) => c.value === event.eventCategory)
    : null;

  const start = event.startDate ? dayjs(event.startDate) : null;
  const end = event.endDate ? dayjs(event.endDate) : null;

  const [coverFailed, setCoverFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const showCover = !!event.coverImage && !coverFailed;
  const coverSrc = event.coverImage ? imgSrc(event.coverImage) : null;

  return (
    <article className="flex h-full w-full flex-col gap-4 p-4">
      <div
        className={`relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 ${
          showCover && coverSrc ? "cursor-zoom-in" : ""
        }`}
        onClick={() => {
          if (showCover && coverSrc) setLightboxOpen(true);
        }}
        role={showCover && coverSrc ? "button" : undefined}
        tabIndex={showCover && coverSrc ? 0 : undefined}
        aria-label={showCover && coverSrc ? "Ampliar imagem" : undefined}
        onKeyDown={(e) => {
          if (showCover && coverSrc && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setLightboxOpen(true);
          }
        }}
      >
        {showCover && coverSrc ? (
          <Image
            src={coverSrc}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            onError={() => setCoverFailed(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">
            {category?.emoji ?? "✨"}
          </div>
        )}
        <div className="absolute left-3 top-3">
          <EventBadges event={event} />
        </div>
      </div>

      {showCover && coverSrc && (
        <ImageLightbox
          src={coverSrc}
          alt={event.title}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="space-y-2">
        {category && (
          <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <span>{category.emoji}</span>
            {category.label}
          </div>
        )}
        <h1 className="text-xl font-bold leading-tight">{event.title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Visualizometro count={event.viewCount} />
        <LikeButton
          slug={event.publicSlug}
          likesCount={event.likesCount}
          isLiked={isLiked}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-border/60 p-3 text-sm">
        {start && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">
              {start.format("dddd, DD [de] MMMM [de] YYYY")}
            </span>
          </div>
        )}
        {start && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {start.format("HH:mm")}
              {end && ` — ${end.format("HH:mm")}`}
            </span>
          </div>
        )}
        {(event.address || event.city || event.state) && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {[event.address, event.city, event.state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
      </div>

      {event.description && <RichDescription text={event.description} />}

      {event.registrationUrl && (
        <Button asChild size="lg" className="w-full">
          <a
            href={event.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Inscrever-se <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      )}

      {canEdit && workspaceId && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full border-orange-500/40 text-orange-300 hover:bg-orange-500/10"
        >
          <Link
            href={`/workspaces/${workspaceId}?actionId=${event.id}`}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar no Workspace
          </Link>
        </Button>
      )}

      {event.user && (
        <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={event.user.image ?? undefined} />
            <AvatarFallback>
              {event.user.name?.slice(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-xs text-muted-foreground">Criado por</div>
            <div className="text-sm font-medium">{event.user.name}</div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Compartilhar
        </div>
        <ShareButtons event={event} />
      </div>

      {showFullCTA && (
        <Button asChild variant="outline" className="mt-auto">
          <Link href={`/calendario/evento/${event.publicSlug}`}>
            Ver página completa <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </article>
  );
}
