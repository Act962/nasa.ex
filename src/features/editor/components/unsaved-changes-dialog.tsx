"use client";

/**
 * Diálogo de "alterações não salvas" — mostrado quando o usuário tenta
 * sair do editor com pendências (via breadcrumb "Automações").
 *
 * 3 ações:
 *   - "Sim, salvar"  → executa save e depois prossegue
 *   - "Não salvar"   → descarta alterações e prossegue
 *   - "Cancelar"     → fecha o diálogo e mantém o usuário no editor
 *
 * Para `beforeunload` (refresh/close), o navegador mostra um diálogo
 * nativo próprio — este componente cobre apenas navegação in-app.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Executa o save e, no sucesso, dispara `onProceed`. */
  onSaveAndProceed: () => void;
  /** Descarta as alterações e dispara `onProceed`. */
  onDiscardAndProceed: () => void;
  /** True enquanto a mutation de save está em flight. */
  saving?: boolean;
};

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSaveAndProceed,
  onDiscardAndProceed,
  saving = false,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterações não salvas</DialogTitle>
          <DialogDescription>
            Você fez alterações na automação. Deseja sair sem salvar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="ghost"
            onClick={onDiscardAndProceed}
            disabled={saving}
            className="text-destructive hover:text-destructive"
          >
            Não salvar
          </Button>
          <Button onClick={onSaveAndProceed} disabled={saving}>
            {saving ? "Salvando…" : "Sim, salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
