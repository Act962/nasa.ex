"use client";

import { useState } from "react";
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
import { useCreateWorkflowFolder } from "../hooks/use-workflow-folders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
}

export function FolderCreateDialog({ open, onOpenChange, trackingId }: Props) {
  const [name, setName] = useState("");
  const createFolder = useCreateWorkflowFolder(trackingId);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createFolder.mutate(
      { trackingId, name: trimmed },
      {
        onSuccess: () => {
          setName("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
          <DialogDescription>
            Pastas ajudam a organizar suas automações.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Nome da pasta</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Onboarding, Reativação..."
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
            disabled={!name.trim() || createFolder.isPending}
          >
            {createFolder.isPending ? "Criando..." : "Criar pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
