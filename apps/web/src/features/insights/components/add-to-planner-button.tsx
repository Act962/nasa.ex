"use client";

import { useState } from "react";
import { CalendarPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

interface Props {
  context?: string;
  suggestedTitle?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}

export function AddToPlannerButton({ context, suggestedTitle, variant = "outline", size = "sm" }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [plannerId, setPlannerId] = useState("");
  const [title, setTitle] = useState(suggestedTitle ?? "");
  const [type, setType] = useState("STATIC");

  const { data: plannersData } = useQuery({
    ...orpc.nasaPlanner.planners.list.queryOptions({}),
    enabled: open,
  });
  const planners = plannersData?.planners ?? [];

  const create = useMutation(
    orpc.nasaPlanner.posts.create.mutationOptions({
      onSuccess: () => {
        toast.success("Post adicionado ao Planner!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
        setOpen(false);
      },
      onError: () => toast.error("Erro ao adicionar ao Planner"),
    }),
  );

  const handleCreate = () => {
    if (!plannerId || !title.trim()) return;
    create.mutate({ plannerId, title, type: type as any });
  };

  return (
    <>
      <Button variant={variant} size={size} className="gap-1.5" onClick={() => setOpen(true)}>
        <CalendarPlusIcon className="size-3.5" />
        Adicionar ao Planner
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlusIcon className="size-4 text-violet-500" />
              Adicionar ao Planner
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {context && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Contexto: <strong>{context}</strong>
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Planner</Label>
              <Select value={plannerId} onValueChange={setPlannerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar planner..." />
                </SelectTrigger>
                <SelectContent>
                  {planners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título do post</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descreva a ação de marketing..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATIC">Imagem Estática</SelectItem>
                  <SelectItem value="CAROUSEL">Carrossel</SelectItem>
                  <SelectItem value="REEL">Reel / Vídeo</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!plannerId || !title.trim() || create.isPending}>
              {create.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
