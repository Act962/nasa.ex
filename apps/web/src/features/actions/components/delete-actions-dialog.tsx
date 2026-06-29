"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  isLoading?: boolean;
}

export function DeleteActionsDialog({
  isOpen,
  onClose,
  onConfirm,
  count,
  isLoading = false,
}: DeleteActionsDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  // Reset input when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
    }
  }, [isOpen]);

  const isConfirmed = confirmText === "CONFIRMAR";

  const handleConfirm = () => {
    if (isConfirmed && !isLoading) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2 text-xl">
            Deletar Ações
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é irreversível e removerá as ações selecionadas
            permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Cuidado!</p>
              <p className="text-xs opacity-80 leading-relaxed">
                Você está prestes a deletar{" "}
                <span className="font-bold">
                  {count} {count === 1 ? "ação" : "ações"}
                </span>
                . Essa operação não pode ser desfeita.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Para confirmar, digite{" "}
                <span className="font-bold text-foreground">"CONFIRMAR"</span>{" "}
                abaixo:
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="confirmDeleteActions">Confirmação</Label>
                <Input
                  id="confirmDeleteActions"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite CONFIRMAR aqui..."
                  className="bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? "Deletando..." : "Confirmar Exclusão"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
