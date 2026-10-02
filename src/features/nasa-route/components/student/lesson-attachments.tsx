"use client";

import { Download, ExternalLink, FileText, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

export interface LessonAttachmentLite {
  id: string;
  kind: "file" | "image" | "link" | string;
  title: string;
  url?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  description?: string | null;
}

export interface PlanAttachment {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  fileKey: string | null;
  fileSize: number | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ATTACHMENT_CARD_CLASS =
  "group flex min-h-14 items-start gap-3 rounded-[18px] border border-line bg-card p-3 transition hover:border-info/30 hover:bg-info/5";

function UnavailableAttachment({ title }: { title: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-muted/30 p-3 text-xs text-muted-foreground">
      {title} · indisponível
    </div>
  );
}

export function PlanAttachmentItem({ attachment }: { attachment: PlanAttachment }) {
  const isPdf = attachment.kind === "pdf";
  const href = isPdf ? (attachment.fileKey ? imgSrc(attachment.fileKey) : null) : attachment.url;

  if (!href) return <UnavailableAttachment title={attachment.title} />;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={isPdf ? true : undefined}
      className={ATTACHMENT_CARD_CLASS}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          isPdf ? "bg-destructive/15 text-destructive" : "bg-info/15 text-info",
        )}
      >
        {isPdf ? <FileText className="size-5" /> : <Link2 className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-info">{attachment.title}</p>
        {attachment.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{attachment.description}</p>
        )}
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {isPdf ? (
            <>
              <Download className="size-3" />
              PDF
              {attachment.fileSize ? ` · ${formatFileSize(attachment.fileSize)}` : ""}
            </>
          ) : (
            <>
              <ExternalLink className="size-3" />
              Link externo
            </>
          )}
        </p>
      </div>
    </a>
  );
}

/** Anexos da aula (arquivo, imagem ou link) com abrir e baixar; só vêm quando o plano inclui a aula. */
export function LessonAttachmentsList({ attachments }: { attachments: LessonAttachmentLite[] }) {
  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        Materiais complementares
      </h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {attachments.map((attachment) => (
          <LessonAttachmentItem key={attachment.id} attachment={attachment} />
        ))}
      </div>
    </div>
  );
}

function LessonAttachmentItem({ attachment }: { attachment: LessonAttachmentLite }) {
  const href =
    attachment.kind === "link"
      ? attachment.url
      : attachment.fileKey
        ? imgSrc(attachment.fileKey)
        : (attachment.url ?? null);

  if (!href) return <UnavailableAttachment title={attachment.title} />;

  const isImage = attachment.kind === "image";
  const isLink = attachment.kind === "link";
  // Arquivos do armazenamento forçam download; link externo só abre.
  const shouldDownload = !isLink;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={shouldDownload ? (attachment.fileName ?? true) : undefined}
      className={ATTACHMENT_CARD_CLASS}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          isLink
            ? "bg-info/15 text-info"
            : isImage
              ? "bg-warning/15 text-warning"
              : "bg-destructive/15 text-destructive",
        )}
      >
        {isLink ? <Link2 className="size-5" /> : <FileText className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-info">{attachment.title}</p>
        {attachment.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{attachment.description}</p>
        )}
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {isLink ? (
            <>
              <ExternalLink className="size-3" />
              Link externo
            </>
          ) : (
            <>
              <Download className="size-3" />
              {isImage ? "Imagem" : "Arquivo"}
              {attachment.fileSize ? ` · ${formatFileSize(attachment.fileSize)}` : ""}
            </>
          )}
        </p>
      </div>
    </a>
  );
}
