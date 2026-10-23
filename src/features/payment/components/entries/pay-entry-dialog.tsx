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
import { todayAsDateInput } from "../../lib/dates";
import { describePaymentError } from "../../lib/describe-error";
import { formatCurrency, parseCurrencyToCents } from "../../lib/format";

// Forma do pagamento registrado à mão — vai para as observações do lançamento, junto com a
// observação livre. Cobre o "cliente pagou por fora" (PIX direto, dinheiro) que para a régua.
const PAYMENT_METHODS = ["PIX direto", "Dinheiro", "Transferência", "Cartão", "Boleto", "Outro"] as const;

interface PayEntryDialogProps {
  /** `openAmountCents` é o saldo que falta receber/pagar. */
  entry: { id: string; openAmountCents: number } | null;
  onClose: () => void;
}

export function PayEntryDialog({ entry, onClose }: PayEntryDialogProps) {
  const payEntry = usePayEntry();
  const { data: accountsData } = usePaymentAccounts();
  const [payAmount, setPayAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayAsDateInput());
  const [method, setMethod] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  function handleClose() {
    setPayAmount("");
    setPaidAt(todayAsDateInput());
    setMethod("");
    setAccountId("");
    setNote("");
    onClose();
  }

  async function handlePay() {
    if (!entry) return;
    const amount = parseCurrencyToCents(payAmount);
    if (!amount) return toast.error("Valor inválido");
    const paymentNote = [method, note.trim()].filter(Boolean).join(" — ");
    try {
      await payEntry.mutateAsync({
        id: entry.id,
        paidAmount: amount,
        // Meio-dia: a data escolhida não muda de dia em nenhum fuso.
        paidAt: paidAt ? `${paidAt}T12:00:00.000Z` : undefined,
        accountId: accountId || undefined,
        paymentNote: paymentNote || undefined,
      });
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
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setPayAmount((entry.openAmountCents / 100).toFixed(2).replace(".", ","))}
              >
                Saldo: {formatCurrency(entry.openAmountCents)} (usar o valor total)
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma</Label>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm focus:outline-none"
              >
                <option value="">Não informar</option>
                {PAYMENT_METHODS.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>{paymentMethod}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Conta bancária</Label>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="">Selecionar...</option>
              {accountsData?.accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: cliente pagou adiantado por fora"
              maxLength={200}
            />
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
