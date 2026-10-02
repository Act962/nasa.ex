"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormSettings } from "@/features/form/components/common/form-settings";
import { PreviewDialog } from "@/features/form/components/common/preview-dialog";
import { useMobileBuilderStore } from "./use-mobile-builder-store";

/** Gavetas de edição do bloco e de ajustes do formulário, e a prévia — no lugar dos painéis laterais do desktop. */

export function BlockEditSheet() {
  const openPanel = useMobileBuilderStore((state) => state.openPanel);
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  const { selectedBlockLayout } = useBuilderStore();
  const LayoutProperties = selectedBlockLayout ? FormBlocks[selectedBlockLayout.blockType]?.propertiesComponent : null;

  return (
    <Sheet open={openPanel === "edit-block"} onOpenChange={(isOpen) => setOpenPanel(isOpen ? "edit-block" : null)}>
      <SheetContent side="bottom" className="max-h-[85svh] gap-2 rounded-t-[26px] px-4 pb-6">
        <SheetHeader className="p-0 pt-2">
          <SheetTitle className="text-base">Editar bloco</SheetTitle>
        </SheetHeader>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {selectedBlockLayout && LayoutProperties ? (
            <LayoutProperties blockInstance={selectedBlockLayout} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Toque num bloco do formulário para editar.</p>
          )}
        </div>
        <Button onClick={() => setOpenPanel(null)}>Pronto</Button>
      </SheetContent>
    </Sheet>
  );
}

export function FormSettingsSheet() {
  const openPanel = useMobileBuilderStore((state) => state.openPanel);
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  return (
    <Sheet open={openPanel === "settings"} onOpenChange={(isOpen) => setOpenPanel(isOpen ? "settings" : null)}>
      <SheetContent side="bottom" className="max-h-[85svh] gap-2 rounded-t-[26px] px-4 pb-6">
        <SheetHeader className="p-0 pt-2">
          <SheetTitle className="text-base">Ajustes do formulário</SheetTitle>
        </SheetHeader>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <FormSettings />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobilePreviewDialog() {
  const openPanel = useMobileBuilderStore((state) => state.openPanel);
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  return <PreviewDialog open={openPanel === "preview"} onOpenChange={(isOpen) => setOpenPanel(isOpen ? "preview" : null)} />;
}
