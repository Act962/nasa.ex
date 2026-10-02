"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { defaultBackgroundColor } from "@/features/form/constants";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlocks } from "@/features/form/lib/form-blocks";

/** Prévia do formulário. Sem `open`, abre pelo próprio botão; com `open`, quem chama controla (ex.: dock do celular). */
export function PreviewDialog({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  const { blockLayouts, formData } = useBuilderStore();
  const isControlled = open !== undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye />
            Prévia
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="flex flex-col grow
       max-h-svh h-full p-0 gap-0 w-screen
        max-w-full"
      >
        <DialogHeader
          className="pt-4 px-4 
        pb-4 shadow-sm bg-background"
        >
          <DialogTitle>Prévia</DialogTitle>
        </DialogHeader>
        <div
          className="
                w-full h-full overflow-y-auto
                scrollbar transition-all duration-300
              "
          style={{
            backgroundColor: formData?.settings?.backgroundColor || defaultBackgroundColor,
          }}
        >
          <div
            className="w-full h-full max-w-[650px] 
          mx-auto"
          >
            <div
              className="w-full relative
                    bg-transparent px-3 pt-4 flex flex-col
                    items-center justify-start
                    pb-14
                    "
            >
              {blockLayouts.length > 0 && (
                <div className="flex flex-col w-full gap-4">
                  {blockLayouts.map((block) => {
                    const FormBlockComponent =
                      FormBlocks[block.blockType].formComponent;
                    return (
                      <FormBlockComponent
                        key={block.id}
                        blockInstance={block}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
