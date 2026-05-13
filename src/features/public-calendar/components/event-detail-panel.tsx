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
import {
  getMapDisplayLabel,
  getMapEmbedUrl,
  isGoogleMapsUrl,
} from "../utils/maps";
import { ClaimEventDialog } from "./claim-event-dialog";
import { ReportEventDialog } from "./report-event-dialog";
import { DisputedBanner } from "./disputed-banner";
import { VerifiedBadge } from "./verified-badge";

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
            onError={() => {
              // Log da URL que falhou — em produção esse warn no F12
              // mostra se a env var resolveu pro host correto e se o
              // arquivo realmente existe no bucket.
              // eslint-disable-next-line no-console
              console.warn(
                "[event-detail-panel] cover image falhou ao carregar:",
                { src: coverSrc, coverImage: event.coverImage },
              );
              setCoverFailed(true);
            }}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">
            {/* Quando a imagem ESTAVA configurada mas falhou (`coverFailed`),
                mostra emoji + dica abaixo. Quando nunca teve imagem,
                mostra só o emoji da categoria. Diferencia "sem capa" de
                "capa quebrada" no UX. */}
            {event.coverImage && coverFailed ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <span>📷</span>
                <span className="text-xs font-normal text-foreground/60">
                  Imagem indisponível
                </span>
              </div>
            ) : (
              <span>{category?.emoji ?? "✨"}</span>
            )}
          </div>
        )}
        {/* Gradiente preto→transparente no topo da capa. Fica ATRÁS das
            badges (mesmo container `absolute`, mas vem antes no DOM),
            dando contraste pra "Novo", "Quase começando" etc serem
            lidas mesmo sobre fotos claras. `pointer-events-none` pra
            não bloquear o click de ampliar a imagem. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/90 via-black/60 to-transparent"
        />
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
          <EventAddress
            address={event.address ?? null}
            city={event.city ?? null}
            state={event.state ?? null}
          />
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

      {/* Banner "ownership contestado" — só aparece quando há disputa
          ativa (criador rejeitou claim OU score de reports atingiu
          threshold). Aviso visual sem esconder o evento. */}
      {(event as unknown as { isDisputed?: boolean }).isDisputed && (
        <DisputedBanner
          reason={(event as unknown as { disputeReason?: string | null }).disputeReason ?? null}
        />
      )}

      {/* Ações de moderação — qualquer visitante (exceto criador) pode
          reivindicar. Denúncia é leve, todos podem submeter. Os 2
          ficam abaixo do botão de editar pra não competir visualmente
          com a CTA principal de inscrição. */}
      {!canEdit && (
        <div className="flex flex-wrap gap-2">
          <ClaimEventDialog actionId={event.id} />
          <ReportEventDialog actionId={event.id} />
        </div>
      )}

      {event.user && (
        <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={event.user.image ?? undefined} />
            <AvatarFallback>
              {event.user.name?.slice(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Criado por</div>
            <div className="flex items-center gap-1 text-sm font-medium">
              <span className="truncate">{event.user.name}</span>
              {/* Badge "Verificado" quando a org do criador tem
                  isVerified=true. Sinaliza marca legítima — fortalece
                  confiança no evento. */}
              {(event as unknown as {
                organization?: { isVerified?: boolean };
              }).organization?.isVerified && <VerifiedBadge />}
            </div>
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

/**
 * Bloco "endereço + mapa". Comportamento:
 *
 *  - Renderiza o texto do endereço (cidade/estado quando presentes).
 *  - Se `address` for uma URL do Google Maps, mostra "Ver no Google Maps"
 *    como link clicável; senão mostra o texto puro.
 *  - Renderiza `<iframe>` do Google Maps abaixo (sempre que houver
 *    `address` ou pelo menos cidade/estado).
 *
 * Iframe usa o endpoint sem API key (`maps.google.com/maps?q=...&output=embed`).
 * Suporta texto puro, URLs longas E short links (`maps.app.goo.gl`,
 * `goo.gl/maps`) porque o Google interpreta tudo como busca textual.
 */
function EventAddress({
  address,
  city,
  state,
}: {
  address: string | null;
  city: string | null;
  state: string | null;
}) {
  // Pra busca do mapa preferimos a URL do Maps (mais preciso); senão
  // monta `endereço, cidade, estado` pra a busca de texto.
  const mapQuery =
    address && isGoogleMapsUrl(address)
      ? address
      : [address, city, state].filter(Boolean).join(", ");
  const embedUrl = getMapEmbedUrl(mapQuery);

  // Texto de exibição: se endereço é URL, mostra "Ver no Google Maps"
  // como link; senão concatena endereço + cidade + estado.
  const addressLabel = address ? getMapDisplayLabel(address) : "";
  const locationLine = [
    addressLabel,
    !address || !isGoogleMapsUrl(address) ? city : null,
    !address || !isGoogleMapsUrl(address) ? state : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        {address && isGoogleMapsUrl(address) ? (
          <span className="flex flex-col gap-1">
            <a
              href={address}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {addressLabel}
              <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
            {(city || state) && (
              <span className="text-xs text-muted-foreground">
                {[city, state].filter(Boolean).join(", ")}
              </span>
            )}
          </span>
        ) : (
          <span>{locationLine}</span>
        )}
      </div>
      {embedUrl && (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <iframe
            src={embedUrl}
            title="Mapa do local do evento"
            width="100%"
            height="240"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block"
            // `allow=fullscreen` permite o user expandir; sem outras
            // permissões (sem geolocation/microphone) pra evitar warns.
            allow="fullscreen"
          />
        </div>
      )}
    </div>
  );
}
