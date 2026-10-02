"use client";

import { useEffect, useRef } from "react";
import { Files, Layers3, Plus, Settings2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { BUILDER_BOTTOM_SHEET_CLASSES } from "../../lib/mobile-sheet-classes";
import type { PageLayout } from "../../types";
import { PropertiesPanelContent } from "../properties-panel/properties-panel";
import { BuilderSidebarPanel } from "./builder-sidebar";
import type { Tab } from "./builder-sidebar-config";
import { BuilderSelectionHint } from "./builder-selection-hint";
import { useBuilderMobilePanelStore, type BuilderMobilePanel } from "./use-builder-mobile-panel-store";

/**
 * Editor no celular: os painéis laterais viram gavetas de baixo, abertas pelo menu em órbita
 * (Camadas, Páginas · Editar, Ajustes) com "+ Bloco" no centro no lugar do ASTRO.
 */

const SHEET_META: Record<BuilderMobilePanel, { title: string; description: string; tabIds?: Tab[] }> = {
  add: { title: "Adicionar", description: "Toque num elemento ou bloco para pôr na página.", tabIds: ["elements", "blocks"] },
  layers: { title: "Camadas", description: "Ordem dos blocos da página.", tabIds: ["layers"] },
  pages: { title: "Páginas do site", description: "Início e páginas internas.", tabIds: ["pages"] },
  settings: { title: "Ajustes da página", description: "Endereço, cores, pixels e destino do lead.", tabIds: ["page"] },
  properties: { title: "Editar bloco", description: "Textos, imagens, botões e cores do bloco selecionado." },
};

export function useBuilderOrbitDock() {
  const setOpenPanel = useBuilderMobilePanelStore((state) => state.setOpenPanel);
  const openPanel = useBuilderMobilePanelStore((state) => state.openPanel);
  const hasSelection = usePagesBuilderStore((state) => state.selected.length > 0);

  useRegisterOrbitDock({
    leftItems: [
      { label: "Camadas", icon: <Layers3 />, onSelect: () => setOpenPanel("layers"), isActive: openPanel === "layers" },
      { label: "Páginas", icon: <Files />, onSelect: () => setOpenPanel("pages"), isActive: openPanel === "pages" },
    ],
    rightItems: [
      {
        label: "Editar",
        icon: <SlidersHorizontal />,
        onSelect: () => setOpenPanel("properties"),
        isActive: openPanel === "properties" || hasSelection,
      },
      { label: "Ajustes", icon: <Settings2 />, onSelect: () => setOpenPanel("settings"), isActive: openPanel === "settings" },
    ],
    centerAction: { label: "Bloco", icon: <Plus />, onSelect: () => setOpenPanel("add") },
  });
}

export function BuilderMobileSheets() {
  const openPanel = useBuilderMobilePanelStore((state) => state.openPanel);
  const setOpenPanel = useBuilderMobilePanelStore((state) => state.setOpenPanel);
  const layout = usePagesBuilderStore((state) => state.layout);
  const hasSelection = usePagesBuilderStore((state) => state.selected.length > 0);
  const layoutWhenAddOpenedRef = useRef<PageLayout | null>(null);

  // Depois de pôr um elemento ou bloco, a gaveta fecha para mostrar o resultado no canvas.
  useEffect(() => {
    if (openPanel !== "add") {
      layoutWhenAddOpenedRef.current = null;
      return;
    }
    if (layoutWhenAddOpenedRef.current === null) {
      layoutWhenAddOpenedRef.current = layout;
      return;
    }
    if (layout !== layoutWhenAddOpenedRef.current) setOpenPanel(null);
  }, [openPanel, layout, setOpenPanel]);

  useEffect(() => () => setOpenPanel(null), [setOpenPanel]);

  const sheetMeta = openPanel ? SHEET_META[openPanel] : null;

  return (
    <Sheet open={openPanel !== null} onOpenChange={(isOpen) => !isOpen && setOpenPanel(null)}>
      <SheetContent side="bottom" className={BUILDER_BOTTOM_SHEET_CLASSES}>
        <SheetHeader className="shrink-0 px-5 pt-5 pb-1">
          <SheetTitle className="text-base">{sheetMeta?.title}</SheetTitle>
          <SheetDescription className="text-xs">{sheetMeta?.description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          {openPanel === "properties" ? (
            <div className="h-full overflow-y-auto">
              {hasSelection ? <PropertiesPanelContent /> : <BuilderSelectionHint />}
            </div>
          ) : (
            sheetMeta?.tabIds && (
              <BuilderSidebarPanel key={openPanel} visibleTabIds={sheetMeta.tabIds} isPropertiesEmbedded={false} />
            )
          )}
        </div>
        <div className="shrink-0 px-4 pt-2 pb-4">
          <Button className="h-12 w-full rounded-full" onClick={() => setOpenPanel(null)}>
            Pronto
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
