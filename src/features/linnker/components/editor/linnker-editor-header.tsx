"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink, Eye, EyeOff, LayoutGridIcon, Link2, MoreHorizontal, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LinnkerStatusPill } from "../linnker-status-pill";
import { LINNKER_EDITOR_SECTIONS, type LinnkerEditorSection } from "./linnker-editor-sections";
import type { LinnkerPage } from "../../types";

interface LinnkerEditorHeaderProps {
  page: LinnkerPage;
  activeSection: LinnkerEditorSection;
  onTogglePublish: () => void;
  isTogglingPublish: boolean;
  onOpenPreview: () => void;
}

export function LinnkerEditorHeader({
  page,
  activeSection,
  onTogglePublish,
  isTogglingPublish,
  onOpenPreview,
}: LinnkerEditorHeaderProps) {
  const publicPath = `/l/${page.slug}`;
  const sectionMeta = LINNKER_EDITOR_SECTIONS[activeSection];

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
    toast.success("Link copiado!");
  };

  const publishLabel = page.isPublished ? "Despublicar" : "Publicar";
  const PublishIcon = page.isPublished ? EyeOff : Eye;

  return (
    <div className="flex items-center gap-2.5 pt-2 pb-4 md:pt-6">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 md:size-11">
        <sectionMeta.icon className="size-5 text-info md:hidden" />
        <Link2 className="size-5 text-info max-md:hidden" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Celular: o título é a seção atual (o menu de baixo troca de seção); computador: o nome da página. */}
        <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:hidden">{sectionMeta.label}</h1>
        <div className="flex min-w-0 items-center gap-2 max-md:hidden">
          <h1 className="truncate text-xl leading-tight font-semibold">{page.title}</h1>
          <LinnkerStatusPill isPublished={page.isPublished} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <span className="md:hidden">
            {page.title} · {page.isPublished ? "Publicada" : "Rascunho"}
          </span>
          <span className="max-md:hidden">{publicPath}</span>
        </p>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="size-10 shrink-0 rounded-full lg:hidden"
        onClick={onOpenPreview}
        aria-label="Ver prévia"
        title="Ver prévia"
      >
        <Smartphone className="size-4" />
      </Button>

      <Button variant="outline" size="sm" className="shrink-0 rounded-full max-md:hidden" asChild>
        <Link href="/linnker">
          <LayoutGridIcon className="size-4" /> Todas as páginas
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="shrink-0 rounded-full max-md:hidden" asChild>
        <a href={publicPath} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" /> Ver página
        </a>
      </Button>

      {/* Celular: só "Publicar" fica à vista; "Despublicar" vai para o menu ⋯. */}
      <Button
        variant={page.isPublished ? "outline" : "default"}
        className={cn("h-10 shrink-0 rounded-full px-4 md:h-8", page.isPublished && "max-md:hidden")}
        onClick={onTogglePublish}
        disabled={isTogglingPublish}
      >
        <PublishIcon className="size-4 max-sm:hidden" /> {publishLabel}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-10 shrink-0 rounded-full md:hidden" aria-label="Mais ações">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={publicPath} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Ver página
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="size-4" /> Copiar link
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/linnker">
              <LayoutGridIcon className="size-4" /> Todas as páginas
            </Link>
          </DropdownMenuItem>
          {page.isPublished && (
            <DropdownMenuItem onClick={onTogglePublish} disabled={isTogglingPublish}>
              <EyeOff className="size-4" /> Despublicar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
