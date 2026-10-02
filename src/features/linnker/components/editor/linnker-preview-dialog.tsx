"use client";

import { Smartphone } from "lucide-react";
import { LinnkerPreview } from "../linnker-preview";
import { LinnkerSheetDialog } from "../linnker-sheet-dialog";
import type { LinnkerPage } from "../../types";

interface LinnkerPreviewDialogProps {
  page: LinnkerPage | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** No celular a prévia ao lado não cabe: abre numa gaveta com as mudanças ainda não salvas. */
export function LinnkerPreviewDialog({ page, open, onOpenChange }: LinnkerPreviewDialogProps) {
  return (
    <LinnkerSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Prévia da página"
      icon={<Smartphone className="size-4 text-info" />}
      description="Como o visitante vê, com as mudanças que você ainda não salvou."
      bodyClassName="pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <LinnkerPreview page={page} />
    </LinnkerSheetDialog>
  );
}
