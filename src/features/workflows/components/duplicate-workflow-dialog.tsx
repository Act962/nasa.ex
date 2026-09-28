"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyIcon } from "lucide-react";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useDuplicateWorkflow } from "../hooks/use-workflows";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  workflowName: string;
  currentTrackingId: string;
}

export function DuplicateWorkflowDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
  currentTrackingId,
}: Props) {
  const { trackings, isLoading: trackingsLoading } = useQueryTrackings();
  const duplicate = useDuplicateWorkflow();

  const [name, setName] = useState("");
  const [targetTrackingId, setTargetTrackingId] = useState(currentTrackingId);

  // Reseta o form sempre que abrir com um workflow novo — nome default segue
  // a convenção "Nome (cópia)" pra o usuário identificar. Destino default é o
  // tracking atual (o caso 1-clique mais comum).
  useEffect(() => {
    if (open) {
      setName(`${workflowName} (cópia)`);
      setTargetTrackingId(currentTrackingId);
    }
  }, [open, workflowName, currentTrackingId]);

  const sortedTrackings = useMemo(() => {
    // Tracking atual primeiro pra ficar em cima do select.
    const current = trackings.find((tracking) => tracking.id === currentTrackingId);
    const others = trackings.filter(
      (tracking) => tracking.id !== currentTrackingId,
    );
    return current ? [current, ...others] : trackings;
  }, [trackings, currentTrackingId]);

  const targetTracking = trackings.find(
    (tracking) => tracking.id === targetTrackingId,
  );
  const isCrossTracking = targetTrackingId !== currentTrackingId;

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || !targetTrackingId) return;

    duplicate.mutate(
      {
        workflowId,
        targetTrackingId,
        name: trimmedName,
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          toast.success(
            isCrossTracking
              ? `"${data.name}" duplicado em "${targetTracking?.name ?? "outro tracking"}"`
              : `"${data.name}" duplicado`,
            {
              action: (
                <Button asChild size="sm" variant="outline">
                  <Link href={data.editorUrl}>Abrir cópia</Link>
                </Button>
              ),
            },
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyIcon className="size-4" />
            Duplicar automação
          </DialogTitle>
          <DialogDescription>
            A cópia nasce desativada — revise antes de ligar. Nodes,
            conexões e configurações são preservados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="duplicate-workflow-name">Nome da cópia</Label>
            <Input
              id="duplicate-workflow-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              maxLength={200}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duplicate-workflow-target">Destino</Label>
            <Select
              value={targetTrackingId}
              onValueChange={setTargetTrackingId}
              disabled={trackingsLoading}
            >
              <SelectTrigger id="duplicate-workflow-target" className="w-full">
                <SelectValue
                  placeholder={
                    trackingsLoading ? "Carregando..." : "Selecione o tracking"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sortedTrackings.map((tracking) => (
                  <SelectItem key={tracking.id} value={tracking.id}>
                    {tracking.name}
                    {tracking.id === currentTrackingId && (
                      <span className="text-muted-foreground text-xs ml-2">
                        (atual)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCrossTracking && (
              <p className="text-xs text-muted-foreground">
                Tags e participantes específicos do tracking de origem podem
                precisar ser reconfigurados no destino.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={duplicate.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !name.trim() || !targetTrackingId || duplicate.isPending
            }
          >
            {duplicate.isPending ? "Duplicando..." : "Duplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
