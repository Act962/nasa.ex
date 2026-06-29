"use client";

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
import { AlertTriangleIcon } from "lucide-react";

/**
 * Dialog padrão de consentimento "Visualização Pública".
 *
 * Usado em N-Box (arquivos), Forms, OrgProjects (workspaces compartilhados)
 * e Agenda — sempre que o usuário liga uma flag que torna conteúdo
 * acessível publicamente.
 *
 * O texto é IDÊNTICO em todos os usos pra manter a UX consistente. O
 * `resourceLabel` (ex: "arquivo", "formulário", "projeto") é só pra
 * lembrar o usuário do que ele está autorizando — o texto principal
 * permanece igual.
 *
 * Quando confirmado, a mutation no caller DEVE enviar `consent: true`
 * pro backend; as procedures validam isso e logam em
 * `logActivity` (Atividades no admin + insights).
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  /** Texto custom do botão de confirmar (default: "Sim, tornar público"). */
  confirmLabel?: string;
  /** Texto custom do título (default: "Atenção!"). */
  title?: string;
}

export function PublicVisibilityDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  confirmLabel = "Sim, tornar público",
  title = "Atenção!",
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            Ao selecionar como{" "}
            <strong className="text-foreground">
              &quot;Visualização Pública&quot;
            </strong>{" "}
            você concede direito à qualquer usuário acessar o arquivo, assim
            como baixá-lo.
            <br />
            <br />
            Tem certeza que deseja fazer isso?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-400"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
