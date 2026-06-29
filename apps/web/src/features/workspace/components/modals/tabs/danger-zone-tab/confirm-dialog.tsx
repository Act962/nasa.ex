"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteWorkspaceConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  workspaceName: string;
  isLoading?: boolean;
}

export function DeleteWorkspaceConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  workspaceName,
  isLoading = false,
}: DeleteWorkspaceConfirmDialogProps) {
  const [confirmName, setConfirmName] = useState("");

  // Reset input when dialog closes or opens
  useEffect(() => {
    if (!isOpen) {
      setConfirmName("");
    }
  }, [isOpen]);

  const isConfirmed = confirmName === workspaceName;

  const handleConfirm = () => {
    if (isConfirmed && !isLoading) {
      onConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2 text-xl">
            Deletar Workspace
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível e removerá todos os dados permanentemente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Cuidado!</p>
              <p className="text-xs opacity-80 leading-relaxed">
                Ao deletar este workspace, todos os dados, configurações e
                históricos associados serão permanentemente removidos.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Para confirmar, digite{" "}
                <span className="font-bold text-foreground">
                  "{workspaceName}"
                </span>{" "}
                abaixo:
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="confirmName">Nome do Workspace</Label>
                <Input
                  id="confirmName"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Digite o nome aqui..."
                  className="bg-background"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <DialogClose asChild>
            <Button variant="ghost" disabled={isLoading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? "Deletando..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
