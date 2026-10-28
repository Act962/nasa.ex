"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { usePayEntry, usePaymentAccounts } from "../../hooks/use-payment";
import { todayAsDateInput } from "../../lib/dates";
import { describePaymentError } from "../../lib/describe-error";
import { formatCurrency, parseCurrencyToCents } from "../../lib/format";
import { DateField } from "../shared/date-field";

// Forma do pagamento registrado à mão — vai para as observações do lançamento, junto com a
// observação livre. Cobre o "cliente pagou por fora" (PIX direto, dinheiro) que para a régua.
const PAYMENT_METHODS = ["PIX direto", "Dinheiro", "Transferência", "Cartão", "Boleto", "Outro"] as const;
/** Radix não aceita valor vazio no Select: marca "não informar" / "sem conta". */
const NOT_INFORMED = "__none__";

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
              <DateField value={paidAt} onChange={setPaidAt} />
            </div>
            <div className="space-y-2">
              <Label>Forma</Label>
              <Select
                value={method || NOT_INFORMED}
                onValueChange={(value) => setMethod(value === NOT_INFORMED ? "" : value)}
              >
                <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_INFORMED}>Não informar</SelectItem>
                  {PAYMENT_METHODS.map((paymentMethod) => (
                    <SelectItem key={paymentMethod} value={paymentMethod}>{paymentMethod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Conta bancária</Label>
            <Select
              value={accountId || NOT_INFORMED}
              onValueChange={(value) => setAccountId(value === NOT_INFORMED ? "" : value)}
            >
              <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NOT_INFORMED}>Sem conta</SelectItem>
                {accountsData?.accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
