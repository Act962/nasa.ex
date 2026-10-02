"use client";

import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Link2, ExternalLink, Pencil, Trash2, Eye, EyeOff, Tags } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { LinnkerPage } from "../types";
import { CopyLinkWithUtm } from "@/components/ui/copy-link-with-utm";
import { LinnkerPageThumbnail } from "./pages/linnker-page-thumbnail";
import { LinnkerStatusPill } from "./linnker-status-pill";

interface Props {
  page: LinnkerPage;
  onRefetch: () => void;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function LinnkerPageCard({ page, onRefetch }: Props) {
  const { mutate: togglePublish, isPending: isTogglingPublish } = useMutation({
    mutationFn: () =>
      client.linnker.updatePage({ id: page.id, isPublished: !page.isPublished }),
    onSuccess: () => {
      toast.success(page.isPublished ? "Página despublicada" : "Página publicada!");
      onRefetch();
    },
  });

  const { mutate: deletePage, isPending: isDeleting } = useMutation({
    mutationFn: () => client.linnker.deletePage({ id: page.id }),
    onSuccess: () => { toast.success("Página excluída"); onRefetch(); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/l/${page.slug}`;
  const editorHref = `/linnker/${page.id}`;
  const visitCount = page._count?.scans ?? 0;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  };

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-line bg-card transition-shadow hover:shadow-sm">
      <Link href={editorHref} className="relative block" aria-label={`Editar ${page.title}`}>
        <LinnkerPageThumbnail slug={page.slug} title={page.title} versionKey={String(page.updatedAt)} />
        <LinnkerStatusPill isPublished={page.isPublished} className="absolute top-2 left-2 shadow-sm" />
      </Link>

      <div className="flex items-start gap-1 p-3 pr-1.5">
        <Link href={editorHref} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{page.title}</h3>
          <p className="truncate text-[11px] text-muted-foreground">/l/{page.slug}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {pluralize(page.links.length, "link", "links")} · {pluralize(visitCount, "visita", "visitas")}
          </p>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" aria-label="Mais ações">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={editorHref}>
                <Pencil className="size-4" /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyLink}>
              <Link2 className="size-4" /> Copiar link
            </DropdownMenuItem>
            <CopyLinkWithUtm
              baseUrl={publicUrl}
              trigger={
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <Tags className="size-4" /> Copiar link com UTM
                </DropdownMenuItem>
              }
            />
            <DropdownMenuItem asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Ver página
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => togglePublish()} disabled={isTogglingPublish}>
              {page.isPublished ? (
                <><EyeOff className="size-4" /> Despublicar</>
              ) : (
                <><Eye className="size-4" /> Publicar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deletePage()}
              disabled={isDeleting}
            >
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
