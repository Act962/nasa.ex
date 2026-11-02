"use client";
/* eslint-disable orbita/no-hardcoded-color -- imita as cores do Facebook e do Instagram, não o tema do app */

import { useState } from "react";
import { Bookmark, Globe, Heart, ImageIcon, MessageCircle, MoreHorizontal, Send, Share2, ThumbsUp, X } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Prévia do anúncio de WhatsApp como ele aparece na Meta (spec 0126): feed do Facebook,
 * feed do Instagram e Stories/Reels. É só ilustração com os dados do cliente — a Meta
 * ainda revisa e pode cortar o texto de outro jeito.
 */

type PreviewFormat = "facebook_feed" | "instagram_feed" | "stories";

const FORMAT_LABEL: Record<PreviewFormat, string> = {
  facebook_feed: "Facebook",
  instagram_feed: "Instagram",
  stories: "Stories e Reels",
};

const TEXT_PREVIEW_CHARS = 125;

export interface MetaAdPreviewMedia {
  kind: "IMAGE" | "VIDEO";
  url: string;
}

interface MetaAdPreviewProps {
  pageName: string;
  avatarUrl: string | null;
  instagramUsername: string | null;
  message: string;
  headline: string;
  media: MetaAdPreviewMedia | null;
}

function Avatar({ url, name, className }: { url: string | null; name: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- foto do perfil vem do CDN da Meta
    return <img src={url} alt={name} className={cn("rounded-full object-cover", className)} />;
  }
  return (
    <div className={cn("grid place-items-center rounded-full bg-[#1877F2] font-semibold text-white", className)}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Media({ media, className }: { media: MetaAdPreviewMedia | null; className?: string }) {
  if (!media) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-[#F0F2F5] text-[#65676B]", className)}>
        <ImageIcon className="size-6" />
        <span className="text-xs">Seu criativo aparece aqui</span>
      </div>
    );
  }
  if (media.kind === "VIDEO") {
    return <video src={media.url} controls playsInline className={cn("bg-black object-contain", className)} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- arquivo local do cliente ou prévia da Meta
  return <img src={media.url} alt="Criativo do anúncio" className={cn("bg-black object-contain", className)} />;
}

function TruncatedText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!text) return <span className="text-[#65676B]">O texto do anúncio aparece aqui.</span>;
  if (isExpanded || text.length <= TEXT_PREVIEW_CHARS) return <span className="whitespace-pre-line">{text}</span>;
  return (
    <span>
      {text.slice(0, TEXT_PREVIEW_CHARS).trimEnd()}{" "}
      <button type="button" className="text-[#65676B]" onClick={() => setIsExpanded(true)}>
        ...Ver mais
      </button>
    </span>
  );
}

function FacebookFeed({ pageName, avatarUrl, message, headline, media }: MetaAdPreviewProps) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-white text-[#050505] shadow-sm">
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <Avatar url={avatarUrl} name={pageName} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{pageName}</p>
          <p className="flex items-center gap-1 text-[13px] text-[#65676B]">
            Patrocinado · <Globe className="size-3" />
          </p>
        </div>
        <MoreHorizontal className="size-5 text-[#65676B]" />
        <X className="size-5 text-[#65676B]" />
      </div>
      <p className="px-3 py-2 text-[15px] leading-snug">
        <TruncatedText text={message} />
      </p>
      <Media media={media} className="aspect-[4/5] w-full" />
      <div className="flex items-center gap-3 bg-[#F0F2F5] px-3 py-2.5">
        <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-tight">
          {headline || `Entre em contato com a Página ${pageName}`}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#E4E6EB] px-3 py-2 text-[15px] font-semibold">
          <WhatsappIcon className="size-4" />
          WhatsApp
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-[#E4E6EB] px-3 py-2 text-[13px] text-[#65676B]">
        <span className="inline-flex items-center gap-1">
          <span className="grid size-4 place-items-center rounded-full bg-[#1877F2]">
            <ThumbsUp className="size-2.5 text-white" />
          </span>
          Curtidas
        </span>
        <span>Compartilhamentos</span>
      </div>
      <div className="grid grid-cols-3 px-3 py-1.5 text-[14px] font-semibold text-[#65676B]">
        <span className="flex items-center justify-center gap-1.5 py-1.5">
          <ThumbsUp className="size-4" /> Curtir
        </span>
        <span className="flex items-center justify-center gap-1.5 py-1.5">
          <MessageCircle className="size-4" /> Comentar
        </span>
        <span className="flex items-center justify-center gap-1.5 py-1.5">
          <Share2 className="size-4" /> Compartilhar
        </span>
      </div>
    </div>
  );
}

function InstagramFeed({ pageName, avatarUrl, instagramUsername, message, media }: MetaAdPreviewProps) {
  const username = instagramUsername || pageName.toLowerCase().replace(/\s+/g, "");
  return (
    <div className="overflow-hidden rounded-[12px] bg-white text-[#000] shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar url={avatarUrl} name={pageName} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{username}</p>
          <p className="text-[12px]">Patrocinado</p>
        </div>
        <MoreHorizontal className="size-5" />
      </div>
      <Media media={media} className="aspect-[4/5] w-full" />
      <div className="flex items-center justify-between bg-[#0095F6] px-3 py-2.5 text-[14px] font-semibold text-white">
        Enviar mensagem do WhatsApp
        <span aria-hidden>›</span>
      </div>
      <div className="flex items-center gap-4 px-3 pt-2.5">
        <Heart className="size-6" />
        <MessageCircle className="size-6" />
        <Send className="size-6" />
        <Bookmark className="ml-auto size-6" />
      </div>
      <p className="px-3 pt-1.5 pb-3 text-[14px] leading-snug">
        <span className="font-semibold">{username}</span> <TruncatedText text={message} />
      </p>
    </div>
  );
}

function Stories({ pageName, avatarUrl, message, media }: MetaAdPreviewProps) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[16px] bg-black text-white">
      <Media media={media} className="absolute inset-0 size-full" />
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pt-4 pb-6">
        <Avatar url={avatarUrl} name={pageName} className="size-8 ring-2 ring-white/70" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{pageName}</p>
          <p className="text-[11px] opacity-80">Patrocinado</p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/75 to-transparent px-4 pt-10 pb-5">
        {message && <p className="line-clamp-3 text-[13px] leading-snug">{message}</p>}
        <span className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black">
          <WhatsappIcon className="size-4" />
          Enviar mensagem
        </span>
      </div>
    </div>
  );
}

export function MetaAdPreview(props: MetaAdPreviewProps) {
  const [format, setFormat] = useState<PreviewFormat>("facebook_feed");
  return (
    <div className="mx-auto w-full max-w-[340px] space-y-3">
      <div className="flex justify-center gap-1 overflow-x-auto">
        {(Object.keys(FORMAT_LABEL) as PreviewFormat[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFormat(option)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[11px] transition",
              format === option ? "bg-white text-black" : "bg-white/10 text-white/70",
            )}
          >
            {FORMAT_LABEL[option]}
          </button>
        ))}
      </div>
      <div>
        {format === "facebook_feed" && <FacebookFeed {...props} />}
        {format === "instagram_feed" && <InstagramFeed {...props} />}
        {format === "stories" && <Stories {...props} />}
      </div>
      <p className="text-center text-[11px] text-white/45">
        Prévia ilustrativa. A Meta revisa o anúncio e pode cortar o texto de outro jeito em cada lugar.
      </p>
    </div>
  );
}
