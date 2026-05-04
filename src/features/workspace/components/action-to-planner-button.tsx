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
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

interface Props {
  actionId: string;
  actionTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionToPlannerDialog({ actionId, actionTitle, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [plannerId, setPlannerId] = useState("");
  const [type, setType] = useState("STATIC");

  const { data: plannersData } = useQuery({
    ...orpc.nasaPlanner.planners.list.queryOptions({}),
    enabled: open,
  });
  const planners = plannersData?.planners ?? [];

  const create = useMutation(
    orpc.nasaPlanner.posts.createFromAction.mutationOptions({
      onSuccess: () => {
        toast.success("Ação adicionada ao Planner!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
        onOpenChange(false);
      },
      onError: () => toast.error("Erro ao adicionar ao Planner"),
    }),
  );

  const handleCreate = () => {
    if (!plannerId) return;
    create.mutate({ actionId, plannerId, type: type as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlusIcon className="size-4 text-violet-500" />
            Adicionar ao Planner
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {actionTitle && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Ação: <strong>{actionTitle}</strong>
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
            <Label>Tipo de conteúdo</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!plannerId || create.isPending}>
            {create.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
