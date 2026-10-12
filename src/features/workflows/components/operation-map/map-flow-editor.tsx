"use client";

import { Suspense, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Editor, EditorLoading } from "@/features/editor/components/editor";
import { EditorHeader } from "@/features/editor/components/editor-header";
import { workflowDirtyAtom } from "@/features/editor/store/atoms";
import { orpc } from "@/lib/orpc";

// Edição de um fluxo sem sair do mapa (spec 0092, etapa 2): o editor de sempre abre por cima do
// mapa, com tudo que ele tem (configurar passo, adicionar, ligar, salvar). É o mesmo componente da
// página do fluxo, então salvar segue exatamente o caminho que já existe.

interface MapFlowEditorProps {
  trackingId: string;
  workflowId: string;
  onClose: () => void;
}

export function MapFlowEditor({ trackingId, workflowId, onClose }: MapFlowEditorProps) {
  const queryClient = useQueryClient();
  const hasUnsavedChanges = useAtomValue(workflowDirtyAtom);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  const closeAndRefreshMap = () => {
    // O mapa lê a lista de fluxos: ao fechar, ela é buscada de novo para mostrar o que foi salvo.
    void queryClient.invalidateQueries({ queryKey: orpc.workflow.list.queryKey({ input: { trackingId } }) });
    onClose();
  };
  const requestClose = () => (hasUnsavedChanges ? setIsConfirmingClose(true) : closeAndRefreshMap());

  // Esc fecha, a não ser que uma janela do próprio editor esteja aberta por cima (ela trata o Esc).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (hasUnsavedChanges) {
        setIsConfirmingClose(true);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: orpc.workflow.list.queryKey({ input: { trackingId } }) });
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, onClose, queryClient, trackingId]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/40 p-2 md:p-5">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <Suspense fallback={<EditorLoading />}>
          <div className="pr-12">
            <EditorHeader workflowId={workflowId} />
          </div>
          <main className="min-h-0 flex-1">
            <Editor workflowId={workflowId} />
          </main>
        </Suspense>
        <button
          type="button"
          onClick={requestClose}
          title="Fechar e voltar ao mapa"
          aria-label="Fechar e voltar ao mapa"
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <AlertDialog open={isConfirmingClose} onOpenChange={setIsConfirmingClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>Este fluxo tem alterações que ainda não foram salvas. Se fechar agora, elas se perdem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={closeAndRefreshMap}>Fechar sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
