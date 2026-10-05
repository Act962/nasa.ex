"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Undo2,
  Redo2,
  Save,
  Rocket,
  ArrowLeft,
  ExternalLink,
  Eye,
  Layers,
  Globe,
  Check,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { useState } from "react";
import { PublishDialog } from "../publish-dialog/publish-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { SaveStatus } from "./builder";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";

interface Props {
  page: {
    id: string;
    slug: string;
    title: string;
    status: string;
    layerCount: number;
    customDomain: string | null;
  };
  onPublish: () => void;
  publishing: boolean;
  saveStatus: SaveStatus;
  // Flush manual do autosave. Aguarda concluir antes de
  // navegar/abrir preview. Resolve race condition autosave→navega.
  flushSave: () => Promise<void>;
}

export function BuilderTopbar({
  page,
  onPublish,
  publishing,
  saveStatus,
  flushSave,
}: Props) {
  const router = useRouter();
  const undo = usePagesBuilderStore((s) => s.undo);
  const redo = usePagesBuilderStore((s) => s.redo);
  const canUndo = usePagesBuilderStore((s) => s.canUndo());
  const canRedo = usePagesBuilderStore((s) => s.canRedo());
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const setActiveLayer = usePagesBuilderStore((s) => s.setActiveLayer);
  const [publishOpen, setPublishOpen] = useState(false);

  // Antes de navegar pra outra rota (Voltar, Prévia, Ver publicado),
  // flush autosave pra garantir que o user vê as últimas mudanças.
  const navigateAfterSave = async (
    href: string,
    opts?: { newTab?: boolean },
  ) => {
    try {
      await flushSave();
    } catch {
      // Mesmo se falhar, deixa navegar — o aviso já apareceu via toast
    }
    if (opts?.newTab) {
      window.open(href, "_blank", "noreferrer");
    } else {
      router.push(href);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-1.5 bg-card px-3 sm:gap-2">
        {/* No celular: voltar redondo; Elementos, Camadas, Editar e Ajustes ficam no menu de baixo. */}
        <Button
          size="icon"
          variant="ghost"
          className="size-9 shrink-0 rounded-full bg-knob md:hidden"
          onClick={() => navigateAfterSave("/pages")}
          aria-label="Voltar para os sites"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 gap-1 rounded-full max-md:hidden"
          onClick={() => navigateAfterSave("/pages")}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <div className="mx-1 h-5 w-px bg-border max-md:hidden" />
        <div className="flex min-w-0 flex-1 flex-col md:flex-none">
          <span className="truncate text-sm font-semibold md:max-w-[220px]">{page.title}</span>
          <span className="truncate text-[11px] text-muted-foreground md:max-w-[220px]">/{page.slug}</span>
        </div>
        <div className="hidden md:block h-5 w-px bg-border mx-1" />
        <Button
          size="icon"
          variant="ghost"
          disabled={!canUndo}
          onClick={undo}
          title="Desfazer (⌘Z)"
          className="hidden md:inline-flex shrink-0"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={!canRedo}
          onClick={redo}
          title="Refazer (⌘⇧Z)"
          className="hidden md:inline-flex shrink-0"
        >
          <Redo2 className="size-4" />
        </Button>

        {page.layerCount === 2 && (
          <>
            <div className="hidden md:block h-5 w-px bg-border mx-1" />
            <div className="hidden md:flex items-center rounded-full bg-muted p-0.5">
              <Button
                size="sm"
                variant={activeLayer === "back" ? "default" : "ghost"}
                className="h-7 gap-1 rounded-full text-xs"
                onClick={() => setActiveLayer("back")}
              >
                <Layers className="size-3" />
                Atrás
              </Button>
              <Button
                size="sm"
                variant={activeLayer === "front" ? "default" : "ghost"}
                className="h-7 gap-1 rounded-full text-xs"
                onClick={() => setActiveLayer("front")}
              >
                <Layers className="size-3" />
                Frente
              </Button>
            </div>
          </>
        )}

        <div className="min-w-0 flex-1 max-md:hidden" />

        {/* Autosave — texto só ≥md. Em mobile, só ícone (compacto). */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {saveStatus === "saving" && (
            <>
              <OrbitaSpinner className="size-3.5 text-muted-foreground" />
              <span className="hidden md:inline text-muted-foreground">Salvando…</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3.5 text-success" />
              <span className="hidden md:inline text-success">Salvo</span>
            </>
          )}
          {saveStatus === "dirty" && (
            <>
              <span className="size-1.5 rounded-full bg-warning" />
              <span className="hidden md:inline text-muted-foreground">Mudanças pendentes…</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="size-3.5 text-destructive" />
              <span className="hidden md:inline text-destructive">Falha ao salvar</span>
            </>
          )}
        </div>

        <Badge
          variant={page.status === "PUBLISHED" ? "default" : "secondary"}
          className="ml-1 hidden shrink-0 rounded-full md:inline-flex"
        >
          <Save className="size-3 mr-1" />
          {page.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
        </Badge>

        {/* Botões secundários — só ≥md. Em mobile vão pro kebab. */}
        <Button
          size="sm"
          variant="outline"
          className="hidden shrink-0 gap-1 rounded-full md:inline-flex"
          onClick={() =>
            navigateAfterSave(`/pages/${page.id}/preview`, { newTab: true })
          }
        >
          <Eye className="size-3.5" />
          Prévia
        </Button>

        {page.status === "PUBLISHED" && (
          <Button
            size="sm"
            variant="outline"
            className="hidden shrink-0 gap-1 rounded-full md:inline-flex"
            onClick={() =>
              navigateAfterSave(`/s/${page.slug}`, { newTab: true })
            }
          >
            <ExternalLink className="size-3.5" />
            Ver
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="hidden shrink-0 gap-1 rounded-full md:inline-flex"
          onClick={() => setPublishOpen(true)}
        >
          <Globe className="size-3.5" />
          Domínio
        </Button>

        <Button
          size="icon"
          variant="ghost"
          disabled={!canUndo}
          onClick={undo}
          className="size-9 shrink-0 rounded-full bg-knob md:hidden"
          aria-label="Desfazer"
        >
          <Undo2 className="size-4" />
        </Button>

        {/* Celular: ações secundárias no "⋯". */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 rounded-full bg-knob md:hidden"
              aria-label="Mais ações"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem
              onSelect={() => redo()}
              disabled={!canRedo}
              className="gap-2"
            >
              <Redo2 className="size-4" />
              Refazer
            </DropdownMenuItem>
            {page.layerCount === 2 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setActiveLayer(activeLayer === "back" ? "front" : "back")}
                  className="gap-2"
                >
                  <Layers className="size-4" />
                  {activeLayer === "back" ? "Editar camada da frente" : "Editar camada de trás"}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                navigateAfterSave(`/pages/${page.id}/preview`, { newTab: true })
              }
              className="gap-2"
            >
              <Eye className="size-4" />
              Prévia
            </DropdownMenuItem>
            {page.status === "PUBLISHED" && (
              <DropdownMenuItem
                onSelect={() =>
                  navigateAfterSave(`/s/${page.slug}`, { newTab: true })
                }
                className="gap-2"
              >
                <ExternalLink className="size-4" />
                Ver publicado
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => setPublishOpen(true)}
              className="gap-2"
            >
              <Globe className="size-4" />
              Domínio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="h-9 shrink-0 gap-1 rounded-full px-3.5"
          onClick={onPublish}
          disabled={publishing}
          data-guide={GUIDE_ANCHORS.pagesPublishButton.id}
        >
          <Rocket className="size-3.5" />
          {publishing
            ? "Publicando…"
            : page.status === "PUBLISHED"
              ? "Atualizar"
              : "Publicar"}
        </Button>
        <FullscreenControls />
      </header>
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} pageId={page.id} />

    </>
  );
}
