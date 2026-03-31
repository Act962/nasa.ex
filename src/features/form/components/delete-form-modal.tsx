"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutationDeleteForm } from "../hooks/use-form";

interface DeleteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  formName: string;
}

export function DeleteFormModal({
  open,
  onOpenChange,
  id,
  formName,
}: DeleteFormModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const deleteForm = useMutationDeleteForm();

  const handleConfirm = () => {
    if (confirmName !== formName) return;

    deleteForm.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Formulário excluído com sucesso");
          onOpenChange(false);
          setConfirmName("");
        },
        onError: () => {
          toast.error("Ocorreu um erro ao excluir o formulário");
        },
      },
    );
  };

  const isConfirmDisabled = confirmName !== formName || deleteForm.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={(e) => e.stopPropagation()}
        className="sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir formulário
          </DialogTitle>
          <DialogDescription className="py-2">
            Esta ação é irreversível. Todas as respostas e dados associados
            serão excluídos permanentemente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="text-sm text-muted-foreground font-medium">
            Para confirmar, digite{" "}
            <span className="font-bold text-foreground">"{formName}"</span>{" "}
            abaixo:
          </div>
          <Input
            placeholder="Nome do formulário"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isConfirmDisabled) {
                handleConfirm();
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteForm.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="gap-2"
          >
            {deleteForm.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Confirmar exclusão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
