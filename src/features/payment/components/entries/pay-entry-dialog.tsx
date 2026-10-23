"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { usePayEntry, usePaymentAccounts } from "../../hooks/use-payment";
import { describePaymentError } from "../../lib/describe-error";
import { formatCurrency, parseCurrencyToCents } from "../../lib/format";

interface PayEntryDialogProps {
  /** `openAmountCents` é o saldo que falta receber/pagar. */
  entry: { id: string; openAmountCents: number } | null;
  onClose: () => void;
}

export function PayEntryDialog({ entry, onClose }: PayEntryDialogProps) {
  const payEntry = usePayEntry();
  const { data: accountsData } = usePaymentAccounts();
  const [payAmount, setPayAmount] = useState("");

  function handleClose() {
    setPayAmount("");
    onClose();
  }

  async function handlePay() {
    if (!entry) return;
    const amount = parseCurrencyToCents(payAmount);
    if (!amount) return toast.error("Valor inválido");
    try {
      await payEntry.mutateAsync({ id: entry.id, paidAmount: amount });
      handleClose();
      toast.success("Pagamento registrado!");
      emitTourResult({ kind: GUIDE_RESULT_KINDS.paymentRegistered });
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível registrar o pagamento"));
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Valor pago</Label>
            <Input
              placeholder="R$ 0,00"
              value={payAmount}
              onChange={(event) => setPayAmount(event.target.value)}
              autoFocus
              data-guide={GUIDE_ANCHORS.paymentPaidAmount.id}
            />
            {entry && (
              <p className="text-xs text-muted-foreground">
                Saldo: {formatCurrency(entry.openAmountCents)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Conta bancária</Label>
            <select className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none">
              <option value="">Selecionar...</option>
              {accountsData?.accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={handleClose}>Cancelar</Button>
            <Button
              className="flex-1 bg-success/10 text-success hover:bg-success/20 border border-success/20"
              onClick={handlePay}
              disabled={payEntry.isPending}
              data-guide={GUIDE_ANCHORS.paymentConfirmPay.id}
            >
              {payEntry.isPending ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
