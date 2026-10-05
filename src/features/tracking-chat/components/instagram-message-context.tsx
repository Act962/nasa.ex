"use client";

import { format } from "date-fns";
import { ExternalLink, Instagram, Mail, Reply, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSTAGRAM_MEDIA_TYPE_LABEL,
  readInstagramMetadata,
  type InstagramMediaCard,
} from "../lib/instagram-message-metadata";

/** Contexto de mensagem do Instagram no chat (spec 0062, RF-6): de qual post veio o comentário, ou que é DM. */

const KIND_LABEL = {
  DIRECT_MESSAGE: { icon: Mail, text: "Mensagem no Direct do Instagram", isAutomation: false },
  COMMENT_REPLY: { icon: Reply, text: "Resposta no comentário", isAutomation: false },
  AUTOMATION_COMMENT_REPLY: { icon: Zap, text: "Automação · resposta no post", isAutomation: true },
  AUTOMATION_DIRECT_MESSAGE: { icon: Zap, text: "Automação · Direct", isAutomation: true },
} as const;

export function InstagramPostCard({ media, className }: { media: InstagramMediaCard; className?: string }) {
  const detail = [INSTAGRAM_MEDIA_TYPE_LABEL[media.mediaType], media.publishedAt && format(new Date(media.publishedAt), "HH:mm")].filter(Boolean).join(" · ");
  const content = (
    <>
      {media.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-black/5">
          <Instagram className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{media.title ?? "Post do Instagram"}</span>
        <span className="flex items-center gap-1 text-[11px] opacity-70">
          {detail}
          {media.permalink && <ExternalLink className="size-3" />}
        </span>
      </span>
    </>
  );
  const cardClassName = cn("flex items-center gap-2 rounded-xl border-l-[3px] border-l-[#e1306c] bg-black/5 p-1.5", className);
  return media.permalink ? (
    <a href={media.permalink} target="_blank" rel="noreferrer" className={cardClassName}>
      {content}
    </a>
  ) : (
    <div className={cardClassName}>{content}</div>
  );
}

export function InstagramMessageContext({ metadata, onReplyToComment }: { metadata: unknown; onReplyToComment?: () => void }) {
  const instagram = readInstagramMetadata(metadata);
  if (!instagram) return null;

  if (instagram.kind === "COMMENT") {
    return (
      <div className="space-y-1.5 px-1.5 pt-1">
        <p className="flex items-center gap-1 text-[11px] font-semibold text-[#c2185b]">
          <Instagram className="size-3" />
          Comentário {instagram.media ? `no ${INSTAGRAM_MEDIA_TYPE_LABEL[instagram.media.mediaType]}` : "no Instagram"}
        </p>
        {instagram.media && <InstagramPostCard media={instagram.media} />}
        {onReplyToComment && (
          <button type="button" onClick={onReplyToComment} className="flex items-center gap-1 text-[11px] font-medium opacity-70 hover:opacity-100">
            <Reply className="size-3" /> Responder a este comentário
          </button>
        )}
      </div>
    );
  }

  const label = KIND_LABEL[instagram.kind];
  const LabelIcon = label.icon;
  return (
    <div className="px-1.5 pt-1">
      <p className={cn("flex items-center gap-1 text-[11px] font-semibold", label.isAutomation ? "text-success" : "text-[#c2185b]")}>
        <LabelIcon className="size-3" />
        {label.text}
      </p>
      {instagram.kind === "COMMENT_REPLY" && instagram.media && <InstagramPostCard media={instagram.media} className="mt-1" />}
    </div>
  );
}

/** Botões da DM da automação, mostrados embaixo do texto (o Instagram mostra como botão). */
export function InstagramMessageButtons({ metadata }: { metadata: unknown }) {
  const buttons = readInstagramMetadata(metadata)?.buttons ?? [];
  if (buttons.length === 0) return null;
  return (
    <div className="mt-1 border-t border-black/10 px-1.5 pt-1">
      {buttons.map((button) => (
        <a key={button.url} href={button.url} target="_blank" rel="noreferrer" className="block py-0.5 text-center text-xs font-semibold text-primary">
          {button.title}
        </a>
      ))}
    </div>
  );
}
