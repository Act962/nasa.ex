"use client";

import Link from "next/link";
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
  Loader2,
  AlertCircle,
  MoreVertical,
  Plus,
  Settings2,
} from "lucide-react";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { useState } from "react";
import { PublishDialog } from "../publish-dialog/publish-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BuilderSidebarPanel } from "./builder-sidebar";
import { PropertiesPanelContent } from "../properties-panel/properties-panel";
import type { SaveStatus } from "./builder";

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
  const selectedCount = usePagesBuilderStore((s) => s.selected.length);
  const [publishOpen, setPublishOpen] = useState(false);
  // Drawers mobile — esquerda (elementos) e direita (propriedades).
  // Em md+ ficam fechados sempre (paineis aside já visíveis).
  const [leftSheetOpen, setLeftSheetOpen] = useState(false);
  const [rightSheetOpen, setRightSheetOpen] = useState(false);

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
      <header className="h-14 border-b bg-card px-2 sm:px-3 flex items-center gap-1 sm:gap-2 shrink-0">
        {/* MOBILE: botão "+" abre drawer de Elementos/Blocos/Página. */}
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden shrink-0"
          onClick={() => setLeftSheetOpen(true)}
          title="Adicionar elementos"
        >
          <Plus className="size-5" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="gap-1 shrink-0"
          onClick={() => navigateAfterSave("/pages")}
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="hidden sm:block h-5 w-px bg-border mx-1" />
        <div className="min-w-0 flex flex-col">
          <span className="text-sm font-semibold truncate max-w-[120px] sm:max-w-[220px]">
            {page.title}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[120px] sm:max-w-[220px]">
            /{page.slug}
          </span>
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
            <div className="hidden md:flex items-center rounded-md border p-0.5">
              <Button
                size="sm"
                variant={activeLayer === "back" ? "default" : "ghost"}
                className="h-7 gap-1 text-xs"
                onClick={() => setActiveLayer("back")}
              >
                <Layers className="size-3" />
                Atrás
              </Button>
              <Button
                size="sm"
                variant={activeLayer === "front" ? "default" : "ghost"}
                className="h-7 gap-1 text-xs"
                onClick={() => setActiveLayer("front")}
              >
                <Layers className="size-3" />
                Frente
              </Button>
            </div>
          </>
        )}

        <div className="flex-1 min-w-0" />

        {/* Autosave — texto só ≥md. Em mobile, só ícone (compacto). */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="hidden md:inline text-muted-foreground">Salvando…</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3.5 text-emerald-600" />
              <span className="hidden md:inline text-emerald-700">Salvo</span>
            </>
          )}
          {saveStatus === "dirty" && (
            <>
              <span className="size-1.5 rounded-full bg-amber-500" />
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
          className="ml-1 hidden sm:inline-flex shrink-0"
        >
          <Save className="size-3 mr-1" />
          {page.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
        </Badge>

        {/* Botões secundários — só ≥md. Em mobile vão pro kebab. */}
        <Button
          size="sm"
          variant="outline"
          className="gap-1 hidden md:inline-flex shrink-0"
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
            className="gap-1 hidden md:inline-flex shrink-0"
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
          className="gap-1 hidden md:inline-flex shrink-0"
          onClick={() => setPublishOpen(true)}
        >
          <Globe className="size-3.5" />
          Domínio
        </Button>

        {/* MOBILE: kebab com todas as ações secundárias */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden shrink-0"
              title="Mais ações"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onSelect={() => undo()}
              disabled={!canUndo}
              className="gap-2"
            >
              <Undo2 className="size-4" />
              Desfazer
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => redo()}
              disabled={!canRedo}
              className="gap-2"
            >
              <Redo2 className="size-4" />
              Refazer
            </DropdownMenuItem>
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

        {/* MOBILE: botão "⚙" abre drawer de propriedades (só faz
            sentido se algo está selecionado). */}
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden shrink-0 relative"
          onClick={() => setRightSheetOpen(true)}
          title="Propriedades"
          disabled={selectedCount === 0}
        >
          <Settings2 className="size-5" />
          {selectedCount > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-indigo-500" />
          )}
        </Button>

        <Button
          size="sm"
          className="gap-1 shrink-0"
          onClick={onPublish}
          disabled={publishing}
        >
          <Rocket className="size-3.5" />
          {publishing
            ? "Publicando…"
            : page.status === "PUBLISHED"
              ? "Atualizar"
              : "Publicar"}
        </Button>
      </header>
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} pageId={page.id} />

      {/* Drawer ESQUERDO mobile — Elementos / Blocos / Página.
          Mesmo conteúdo do BuilderSidebar desktop, sem o <aside>
          wrapper (renderiza como <div> dentro do SheetContent). */}
      <Sheet open={leftSheetOpen} onOpenChange={setLeftSheetOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[90vw] sm:w-[340px] flex flex-col gap-0"
        >
          <SheetHeader className="px-4 pt-4 pb-2 shrink-0 border-b">
            <SheetTitle className="text-sm">Adicionar elementos</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <BuilderSidebarPanel />
          </div>
        </SheetContent>
      </Sheet>

      {/* Drawer DIREITO mobile — Propriedades do elemento selecionado.
          Reusa exatamente o PropertiesPanelContent. */}
      <Sheet open={rightSheetOpen} onOpenChange={setRightSheetOpen}>
        <SheetContent
          side="right"
          className="p-0 w-[90vw] sm:w-[340px] flex flex-col gap-0 overflow-hidden"
        >
          <SheetHeader className="px-4 pt-4 pb-2 shrink-0 border-b">
            <SheetTitle className="text-sm">Propriedades</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {selectedCount > 0 ? (
              <PropertiesPanelContent />
            ) : (
              <p className="p-4 text-xs text-muted-foreground text-center">
                Selecione um bloco no canvas pra editar.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
