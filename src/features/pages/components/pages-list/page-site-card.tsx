"use client";

import Link from "next/link";
import { BarChart3, ExternalLink, Files, Globe, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { usePages } from "../../hooks/use-pages";
import { PageSiteThumbnail } from "./page-site-thumbnail";

export type SiteListItem = NonNullable<ReturnType<typeof usePages>["data"]>["pages"][number];

export interface DeletePageTarget {
  id: string;
  title: string;
  isPublished: boolean;
}

export function PageSiteCard({
  site,
  onDeleteRequest,
}: {
  site: SiteListItem;
  onDeleteRequest: (target: DeletePageTarget) => void;
}) {
  const isPublished = site.status === "PUBLISHED";
  const editorHref = `/pages/${site.id}`;
  const subpageCount = site._count?.subpages ?? 0;

  return (
    <article className="group flex min-w-0 flex-col gap-2">
      <Link
        href={editorHref}
        className="relative block overflow-hidden rounded-[18px] border border-line bg-card transition-colors hover:border-info/60"
        aria-label={`Editar ${site.title}`}
      >
        <PageSiteThumbnail pageId={site.id} title={site.title} versionKey={String(new Date(site.updatedAt).getTime())} />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-sm">
          <span className={cn("size-1.5 rounded-full", isPublished ? "bg-success" : "bg-muted-foreground")} />
          {isPublished ? "Publicado" : "Rascunho"}
        </span>
      </Link>

      <div className="flex min-w-0 items-start gap-1 pl-1">
        <Link href={editorHref} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{site.title}</h3>
          <p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
            {site.customDomain ? (
              <>
                <Globe className="size-3 shrink-0" />
                <span className="truncate">{site.customDomain}</span>
              </>
            ) : (
              <span className="truncate">/{site.slug}</span>
            )}
            {subpageCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5">
                · <Files className="size-3" /> {subpageCount + 1}
              </span>
            )}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 rounded-full"
              aria-label={`Mais ações de ${site.title}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="gap-2">
              <Link href={editorHref}>
                <Pencil className="size-4" />
                Editar
              </Link>
            </DropdownMenuItem>
            {isPublished && (
              <DropdownMenuItem asChild className="gap-2">
                <a href={`/s/${site.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Ver publicado
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="gap-2">
              <Link href={`/pages/${site.id}/analytics`}>
                <BarChart3 className="size-4" />
                Visitas e cliques
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onSelect={() => onDeleteRequest({ id: site.id, title: site.title, isPublished })}
            >
              <Trash2 className="size-4" />
              Apagar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
