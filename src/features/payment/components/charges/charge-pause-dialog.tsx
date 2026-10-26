"use client";

// Pausar os avisos de uma cobrança até uma data (cliente prometeu pagar). Os avisos que caírem
// na pausa saem no fim dela — no máximo um por dia ao cliente.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSetChargeDunningPause } from "../../hooks/use-payment-charges";
import { DateField } from "../shared/date-field";
import { toDateInputValue } from "../../lib/dates";

const QUICK_PAUSE_DAYS = [3, 7, 15, 30] as const;

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)));
}

export function ChargePauseDialog({
  entry,
  onClose,
}: {
  entry: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const setPause = useSetChargeDunningPause();
  const [pausedUntil, setPausedUntil] = useState(daysFromToday(7));

  function handleConfirm() {
    if (!entry) return;
    setPause.mutate(
      { entryId: entry.id, pausedUntil },
      {
        onSuccess: () => {
          toast.success("Avisos pausados");
          onClose();
        },
        onError: (error) => toast.error(error.message ?? "Não foi possível pausar"),
      },
    );
  }

  return (
    <Dialog open={!!entry} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pausar avisos</DialogTitle>
          <DialogDescription>
            {entry?.name}: nenhum aviso sai até a data escolhida. Os que caírem na pausa saem no fim dela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PAUSE_DAYS.map((days) => (
              <Button
                key={days}
                type="button"
                variant={pausedUntil === daysFromToday(days) ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPausedUntil(daysFromToday(days))}
              >
                {days} dias
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Pausar até</Label>
            <DateField value={pausedUntil} min={daysFromToday(1)} onChange={setPausedUntil} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={setPause.isPending || !pausedUntil}>
              {setPause.isPending ? "Salvando..." : "Pausar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
