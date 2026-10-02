"use client";

import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const DESTRUCTIVE_ACTION_CLASS = "bg-destructive/10 text-destructive hover:bg-destructive/15";

export function DeleteCourseDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é irreversível. Todas as aulas, módulos, matrículas e progresso serão removidos
            permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={DESTRUCTIVE_ACTION_CLASS}>
            Sim, excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Exclusão de aula exige digitar o título exato, para evitar exclusão acidental. */
export function DeleteLessonDialog({
  lesson,
  confirmText,
  onConfirmTextChange,
  isPending,
  onCancel,
  onConfirm,
}: {
  lesson: { id: string; title: string } | null;
  confirmText: string;
  onConfirmTextChange: (text: string) => void;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={!!lesson}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            Excluir aula permanentemente?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Esta ação é <strong>irreversível</strong>. O vídeo hospedado, o progresso dos alunos e os
              vínculos com planos serão removidos.
            </span>
            <span className="block">Para confirmar, digite o nome exato da aula:</span>
            <span className="block rounded-[12px] bg-muted px-2 py-1 font-mono text-sm">{lesson?.title}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="delete-lesson-confirm" className="text-xs">
            Nome da aula
          </Label>
          <Input
            id="delete-lesson-confirm"
            value={confirmText}
            onChange={(event) => onConfirmTextChange(event.target.value)}
            placeholder="Digite o nome exato"
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || confirmText !== lesson?.title}
            onClick={onConfirm}
            className={DESTRUCTIVE_ACTION_CLASS}
          >
            {isPending ? "Excluindo..." : "Sim, excluir aula"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
