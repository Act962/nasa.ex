"use client";

import { PenLine } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CopyEditorFields, type CopyDraft } from "./copy-editor-fields";

interface CopyEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  draft: CopyDraft;
  onDraftChange: (draft: CopyDraft) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

/** Celular: gaveta de baixo com a ação fixa; computador: janela centralizada. */
export function CopyEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  draft,
  onDraftChange,
  onSubmit,
  isSubmitting,
}: CopyEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-lg",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0",
          "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
        )}
      >
        <div
          aria-hidden
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden"
        />
        <DialogHeader className="shrink-0 px-4 pt-3 pb-3 text-left sm:px-6 sm:pt-5">
          <DialogTitle className="flex items-center gap-2 pr-10 text-base font-semibold">
            <PenLine className="size-4 text-info" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          <CopyEditorFields draft={draft} onChange={onDraftChange} />
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-line bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="hidden rounded-full sm:inline-flex"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="h-12 w-full rounded-full text-base sm:h-9 sm:w-auto sm:text-sm"
          >
            {isSubmitting && <OrbitaSpinner className="mr-1.5 size-4" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
