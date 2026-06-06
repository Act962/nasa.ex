"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, Rocket } from "lucide-react";
import { PublicPageRenderer } from "../public/public-page-renderer";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { ElementBox } from "../elements/element-box";
import { getActiveLayerElements } from "../../context/pages-builder-store";
import { DEVICE_PRESETS } from "../../constants";
import type { PageLayout } from "../../types";

interface Props {
  pageId: string;
  initialLayout: PageLayout;
  palette?: Record<string, string>;
  fontFamily?: string | null;
  /** Slug da org — propagado pro ChatButton ao não estar editando. */
  organizationSlug?: string;
  /** Slug do root site (multi-page). */
  rootSlug?: string;
  /** Páginas-irmãs publicadas — navbar resolve links internos com isso. */
  siblingPages?: Array<{ id: string; slug: string; title: string; isRoot: boolean }>;
}

export function InlineEditProvider({
  pageId,
  initialLayout,
  palette,
  fontFamily,
  organizationSlug,
  rootSlug,
  siblingPages,
}: Props) {
  const [editing, setEditing] = useState(false);
  const setPage = usePagesBuilderStore((s) => s.setPage);
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);

  useEffect(() => {
    if (editing) setPage(pageId, initialLayout);
  }, [editing, pageId, initialLayout, setPage]);

  const { mutate: saveDraft, isPending: savingDraft } = useMutation({
    mutationFn: () =>
      client.pages.inlineEditSave({
        id: pageId,
        layout: (layout ?? initialLayout) as unknown as never,
        publish: false,
      }),
    onSuccess: () => toast.success("Rascunho salvo"),
  });

  const { mutate: publish, isPending: publishing } = useMutation({
    mutationFn: () =>
      client.pages.inlineEditSave({
        id: pageId,
        layout: (layout ?? initialLayout) as unknown as never,
        publish: true,
      }),
    onSuccess: () => {
      toast.success("Alterações publicadas");
      setEditing(false);
      if (typeof window !== "undefined") window.location.reload();
    },
  });

  if (!editing) {
    return (
      <>
        <PublicPageRenderer
          layout={initialLayout}
          palette={palette}
          fontFamily={fontFamily}
          organizationSlug={organizationSlug}
          rootSlug={rootSlug}
          siblingPages={siblingPages}
        />
        <button
          onClick={() => setEditing(true)}
          className="fixed bottom-5 right-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium z-50"
        >
          <Pencil className="size-4" />
          Modo edição
        </button>
      </>
    );
  }

  const activeLayout = layout ?? initialLayout;
  const elements = getActiveLayerElements(activeLayout, activeLayer);
  const artboardWidth = DEVICE_PRESETS.desktop.width;

  return (
    <>
      <div
        className="relative"
        style={{
          minHeight: activeLayout.artboard.minHeight,
          background:
            palette?.bg ?? activeLayout.artboard.background ?? "#ffffff",
          fontFamily: fontFamily ?? "Inter, system-ui, sans-serif",
        }}
      >
        <div
          className="relative mx-auto"
          style={{ width: artboardWidth, maxWidth: "100%" }}
        >
          {elements.map((el) => (
            <ElementBox key={el.id} element={el} editable />
          ))}
        </div>
      </div>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-card border shadow-lg rounded-full px-3 py-2 flex items-center gap-2 z-50">
        <span className="text-xs font-medium text-muted-foreground pl-2">
          Modo edição
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => saveDraft()}
          disabled={savingDraft}
          className="gap-1"
        >
          <Save className="size-3.5" />
          Salvar rascunho
        </Button>
        <Button
          size="sm"
          onClick={() => publish()}
          disabled={publishing}
          className="gap-1"
        >
          <Rocket className="size-3.5" />
          Publicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          className="gap-1"
        >
          <X className="size-3.5" />
          Sair
        </Button>
      </div>
    </>
  );
}
