"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { useConfirmTrafegoPix } from "@/features/trafego/hooks/use-trafego-ops";

interface ConfirmPixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: {
    id: string;
    pixReference: string | null;
    amountBrlCents: number;
    companyName?: string | null;
    email?: string;
  };
  leadId?: string;
}

/**
 * Confirmação do PIX. O valor recebido vem pré-preenchido com o do pedido, mas
 * é editável de propósito: divergência precisa ser registrada, não corrigida
 * no olho — a verba é dinheiro que vai para o anúncio.
 */
export function ConfirmPixDialog({
  open,
  onOpenChange,
  pending,
  leadId,
}: ConfirmPixDialogProps) {
  const [receivedBrl, setReceivedBrl] = useState(
    (pending.amountBrlCents / 100).toFixed(2).replace(".", ","),
  );
  const [note, setNote] = useState("");
  const confirmPix = useConfirmTrafegoPix(leadId);

  const receivedBrlCents = Math.round(
    Number(receivedBrl.replace(/\./g, "").replace(",", ".")) * 100,
  );
  const isValidAmount = Number.isFinite(receivedBrlCents) && receivedBrlCents > 0;
  const hasMismatch = isValidAmount && receivedBrlCents !== pending.amountBrlCents;

  function handleConfirm() {
    confirmPix.mutate(
      { pendingId: pending.id, receivedBrlCents, note: note.trim() || undefined },
      {
        onSuccess: (result) => {
          if (result.alreadyPaid) {
            toast.warning(result.message);
          } else {
            toast.success(result.message);
          }
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar PIX</DialogTitle>
          <DialogDescription>
            Confira o comprovante na conversa antes de confirmar. O cliente recebe o
            link de acesso na hora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Referência</span>
              <span className="font-mono font-semibold">
                {pending.pixReference ?? "—"}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Valor do pedido</span>
              <span className="font-semibold tabular-nums">
                {formatBrlFromCents(pending.amountBrlCents)}
              </span>
            </div>
            {pending.companyName && (
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Cliente</span>
                <span className="truncate">{pending.companyName}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Valor recebido (R$)</Label>
            <Input
              value={receivedBrl}
              onChange={(event) => setReceivedBrl(event.target.value)}
              inputMode="decimal"
              className="mt-1"
            />
            {hasMismatch && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                Diferente do pedido. Vamos marcar como divergência para a equipe conferir
                antes de definir a verba.
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: pago em duas transferências"
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValidAmount || confirmPix.isPending}>
            {confirmPix.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
