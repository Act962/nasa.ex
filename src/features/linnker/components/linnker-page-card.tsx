"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Link2, QrCode, ExternalLink, Pencil, Trash2, Eye, EyeOff, Tags } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { LinnkerPage } from "../types";
import { CopyLinkWithUtm } from "@/components/ui/copy-link-with-utm";

interface Props {
  page: LinnkerPage;
  onRefetch: () => void;
}

export function LinnkerPageCard({ page, onRefetch }: Props) {
  const { mutate: togglePublish, isPending: toggling } = useMutation({
    mutationFn: () =>
      client.linnker.updatePage({ id: page.id, isPublished: !page.isPublished }),
    onSuccess: () => {
      toast.success(page.isPublished ? "Página despublicada" : "Página publicada!");
      onRefetch();
    },
  });

  const { mutate: deletePage, isPending: deleting } = useMutation({
    mutationFn: () => client.linnker.deletePage({ id: page.id }),
    onSuccess: () => { toast.success("Página excluída"); onRefetch(); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/l/${page.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  };

  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      {/* Color bar */}
      <div
        className="h-2 rounded-full w-full"
        style={{ background: page.coverColor }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{page.title}</h3>
          <p className="text-xs text-muted-foreground truncate">/l/{page.slug}</p>
          {page.bio && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{page.bio}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/linnker/${page.id}`}>
                <Pencil className="size-4 mr-2" /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyLink}>
              <Link2 className="size-4 mr-2" /> Copiar link
            </DropdownMenuItem>
            <CopyLinkWithUtm
              baseUrl={publicUrl}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Tags className="size-4 mr-2" /> Copiar link com UTM
                </DropdownMenuItem>
              }
            />
            <DropdownMenuItem asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4 mr-2" /> Ver página
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => togglePublish()} disabled={toggling}>
              {page.isPublished ? (
                <><EyeOff className="size-4 mr-2" /> Despublicar</>
              ) : (
                <><Eye className="size-4 mr-2" /> Publicar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => deletePage()}
              disabled={deleting}
            >
              <Trash2 className="size-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{page.links.length} link{page.links.length !== 1 ? "s" : ""}</span>
          {page._count && <span>{page._count.scans} scan{page._count.scans !== 1 ? "s" : ""}</span>}
        </div>
        <Badge variant={page.isPublished ? "default" : "secondary"} className="text-xs">
          {page.isPublished ? "Publicado" : "Rascunho"}
        </Badge>
      </div>
    </div>
  );
}
