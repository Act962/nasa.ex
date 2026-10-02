"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useDeletePage } from "../../hooks/use-pages";
import type { DeletePageTarget } from "./page-site-card";

/** Confirmação de exclusão; site publicado ganha aviso mais forte (o link para de funcionar). */
export function DeletePageDialog({
  target,
  onClose,
}: {
  target: DeletePageTarget | null;
  onClose: () => void;
}) {
  const { mutate: deletePage, isPending: isDeleting } = useDeletePage();

  const confirmDelete = () => {
    if (!target) return;
    deletePage(
      { id: target.id },
      {
        onSuccess: () => {
          toast.success(target.isPublished ? "Site apagado" : "Rascunho apagado");
          onClose();
        },
        onError: (error: Error) => toast.error(error.message ?? "Erro ao apagar"),
      },
    );
  };

  return (
    <AlertDialog open={!!target} onOpenChange={(isOpen) => !isOpen && !isDeleting && onClose()}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{target?.isPublished ? "Apagar site publicado?" : "Apagar rascunho?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.isPublished ? (
              <>
                Você vai apagar <strong>&ldquo;{target?.title}&rdquo;</strong> para sempre.{" "}
                <strong className="text-destructive">Este site está publicado</strong> — o link público para de
                funcionar na hora.
              </>
            ) : (
              <>
                Você vai apagar o rascunho <strong>&ldquo;{target?.title}&rdquo;</strong> para sempre. Como ele nunca
                foi publicado, só as suas edições serão perdidas.
              </>
            )}
            <br />
            <br />
            <span className="text-xs">Não dá para desfazer. Fica registrado em Insights → Atividade.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              confirmDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            {isDeleting ? (
              <>
                <OrbitaSpinner className="mr-2 size-3.5" />
                Apagando…
              </>
            ) : (
              <>
                <Trash2 className="mr-2 size-3.5" />
                Apagar definitivamente
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
