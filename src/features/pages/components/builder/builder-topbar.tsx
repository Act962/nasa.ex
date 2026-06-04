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
} from "lucide-react";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { useState } from "react";
import { PublishDialog } from "../publish-dialog/publish-dialog";
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
      <header className="h-14 border-b bg-card px-3 flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={() => navigateAfterSave("/pages")}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <div className="h-5 w-px bg-border mx-1" />
        <div className="min-w-0 flex flex-col">
          <span className="text-sm font-semibold truncate max-w-[220px]">
            {page.title}
          </span>
          <span className="text-[10px] text-muted-foreground">/{page.slug}</span>
        </div>
        <div className="h-5 w-px bg-border mx-1" />
        <Button size="icon" variant="ghost" disabled={!canUndo} onClick={undo} title="Desfazer (⌘Z)">
          <Undo2 className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" disabled={!canRedo} onClick={redo} title="Refazer (⌘⇧Z)">
          <Redo2 className="size-4" />
        </Button>

        {page.layerCount === 2 && (
          <>
            <div className="h-5 w-px bg-border mx-1" />
            <div className="flex items-center rounded-md border p-0.5">
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

        <div className="flex-1" />

        {/* Indicador de autosave — feedback claro do estado da gravação.
            "Salvando…" durante save, ✓ "Salvo" quando ok, ⚠ "Falha"
            quando rejected, • "Mudanças não salvas" quando dirty mas
            ainda no debounce. */}
        <div className="flex items-center gap-1.5 text-xs">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Salvando…</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3.5 text-emerald-600" />
              <span className="text-emerald-700">Salvo</span>
            </>
          )}
          {saveStatus === "dirty" && (
            <>
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Mudanças pendentes…</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="size-3.5 text-destructive" />
              <span className="text-destructive">Falha ao salvar</span>
            </>
          )}
        </div>

        <Badge
          variant={page.status === "PUBLISHED" ? "default" : "secondary"}
          className="ml-1"
        >
          <Save className="size-3 mr-1" />
          {page.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
        </Badge>

        <Button
          size="sm"
          variant="outline"
          className="gap-1"
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
            className="gap-1"
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
          className="gap-1"
          onClick={() => setPublishOpen(true)}
        >
          <Globe className="size-3.5" />
          Domínio
        </Button>

        <Button
          size="sm"
          className="gap-1"
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
    </>
  );
}
