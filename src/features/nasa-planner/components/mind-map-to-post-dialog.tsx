"use client";

import { useState } from "react";
import { FileImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plannerId: string;
  initialTitle?: string;
}

const TYPE_OPTIONS = [
  { value: "STATIC",   label: "Imagem Estática" },
  { value: "CAROUSEL", label: "Carrossel" },
  { value: "REEL",     label: "Reel / Vídeo" },
  { value: "STORY",    label: "Story" },
];

export function MindMapToPostDialog({ open, onOpenChange, plannerId, initialTitle = "" }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState("STATIC");

  const create = useMutation(
    orpc.nasaPlanner.posts.create.mutationOptions({
      onSuccess: () => {
        toast.success("Post criado a partir do mapa mental!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
        onOpenChange(false);
        setTitle(initialTitle);
        setType("STATIC");
      },
      onError: () => toast.error("Erro ao criar post"),
    }),
  );

  const handleCreate = () => {
    if (!title.trim()) return;
    create.mutate({ plannerId, title, type: type as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImageIcon className="size-4 text-pink-500" />
            Criar Post do Mapa Mental
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do post..."
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!title.trim() || create.isPending}>
            {create.isPending ? "Criando..." : "Criar Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
