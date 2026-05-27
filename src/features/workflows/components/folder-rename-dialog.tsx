"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { useUpdateWorkflowFolder } from "../hooks/use-workflow-folders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  folderId: string;
  currentName: string;
}

export function FolderRenameDialog({
  open,
  onOpenChange,
  trackingId,
  folderId,
  currentName,
}: Props) {
  const [name, setName] = useState(currentName);
  const update = useUpdateWorkflowFolder(trackingId);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onOpenChange(false);
      return;
    }
    update.mutate(
      { id: folderId, name: trimmed },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renomear pasta</DialogTitle>
          <DialogDescription>Escolha um novo nome.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-folder">Nome</Label>
          <Input
            id="rename-folder"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || update.isPending}
          >
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
