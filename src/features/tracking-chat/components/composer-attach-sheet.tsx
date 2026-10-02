"use client";

import type { ReactNode } from "react";
import { Uploader } from "@/components/file-uploader/uploader";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface ComposerAttachItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Cor do ícone dentro do círculo (token do tema). */
  iconClassName: string;
  onSelect?: () => void;
  /** Item que abre o seletor de arquivo em vez de uma ação. */
  upload?: {
    fileTypeAccepted: "image" | "outros";
    onUpload: (file: string, name?: string) => void;
  };
}

interface ComposerAttachSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ComposerAttachItem[];
  isUploading: boolean;
  onUploadStart: () => void;
}

/** Aba do "+" da caixa de mensagem: grade de ícones redondos, abre de baixo como a aba de Canais. */
export function ComposerAttachSheet({
  open,
  onOpenChange,
  items,
  isUploading,
  onUploadStart,
}: ComposerAttachSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="sr-only">
          <SheetTitle>Anexar</SheetTitle>
          <SheetDescription>Escolha o que enviar na conversa.</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-x-2 gap-y-5 px-4 pt-6">
          {items.map((item) => {
            const tile = (
              <>
                <span
                  className={cn(
                    "relative grid size-16 place-items-center overflow-hidden rounded-full bg-background shadow-xs transition-transform active:scale-95 [&_svg]:size-7",
                    item.iconClassName,
                  )}
                >
                  {item.upload && isUploading ? <Spinner className="size-5" /> : item.icon}
                  {item.upload && !isUploading && (
                    <span className="absolute inset-0 opacity-0">
                      <Uploader
                        onUpload={(file, name) => {
                          item.upload?.onUpload(file, name);
                          onOpenChange(false);
                        }}
                        onUploadStart={onUploadStart}
                        fileTypeAccepted={item.upload.fileTypeAccepted}
                      />
                    </span>
                  )}
                </span>
                <span className="text-center text-xs leading-tight text-foreground">{item.label}</span>
              </>
            );

            if (item.upload) {
              return (
                <div key={item.key} className="flex flex-col items-center gap-2">
                  {tile}
                </div>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onSelect?.();
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-2"
              >
                {tile}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
