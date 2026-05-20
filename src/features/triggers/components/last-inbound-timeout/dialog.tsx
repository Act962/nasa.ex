"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export interface LastInboundTimeoutTriggerData {
  /**
   * Minutos sem nova mensagem inbound do lead antes do gatilho disparar.
   * Mínimo 1, máximo 14400 (10 dias).
   */
  minutes: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: LastInboundTimeoutTriggerData;
  onSave?: (data: LastInboundTimeoutTriggerData) => void;
}

export const LastInboundTimeoutTriggerDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
}: Props) => {
  const [minutes, setMinutes] = useState<number>(data?.minutes ?? 30);

  // Sincroniza quando reabre com dados diferentes
  useEffect(() => {
    if (open) setMinutes(data?.minutes ?? 30);
  }, [open, data?.minutes]);

  const handleSave = () => {
    const safe = Math.max(1, Math.min(14400, Math.round(minutes)));
    onSave?.({ minutes: safe });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Última Interação do Lead</DialogTitle>
          <DialogDescription>
            Dispara quando o lead fica X minutos sem mandar nova mensagem no
            chat. Útil pra cutucar quem parou de responder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lit-minutes">Minutos sem resposta</Label>
            <Input
              id="lit-minutes"
              type="number"
              min={1}
              max={14400}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 30)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Ex: <strong>30</strong> = se o lead ficar 30 minutos sem
              responder após a última mensagem dele, dispara o fluxo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
