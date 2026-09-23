"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdatePaymentAccount } from "../../hooks/use-payment";
import { formatCurrency, parseCurrencyToCents } from "../../lib/format";
import { describePaymentError } from "../../lib/describe-error";

// O usuário digita o saldo que existe hoje no banco; o saldo inicial é deduzido
// dele (spec 0023). Pedir o inicial seria pedir uma conta de cabeça toda vez que
// o extrato não bate.

export interface AdjustableAccount {
  id: string;
  name: string;
  balance: number;
  settledIn: number;
  settledOut: number;
  computedBalance: number;
}

interface AccountBalanceDialogProps {
  account: AdjustableAccount | null;
  onClose: () => void;
}

export function AccountBalanceDialog({ account, onClose }: AccountBalanceDialogProps) {
  const [currentBalanceStr, setCurrentBalanceStr] = useState("");
  const updateAccount = useUpdatePaymentAccount();

  useEffect(() => {
    if (!account) return;
    setCurrentBalanceStr(formatCurrency(account.computedBalance));
  }, [account]);

  if (!account) return null;

  const currentBalance = parseCurrencyToCents(currentBalanceStr);
  const movements = account.settledIn - account.settledOut;
  const nextOpeningBalance = currentBalance - movements;
  const difference = currentBalance - account.computedBalance;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return;
    try {
      await updateAccount.mutateAsync({ id: account.id, balance: nextOpeningBalance });
      toast.success("Saldo ajustado");
      onClose();
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível ajustar o saldo"));
    }
  }

  return (
    <Dialog open={!!account} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Saldo de {account.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Saldo atual na conta (R$)</Label>
            <Input
              placeholder="R$ 0,00"
              value={currentBalanceStr}
              onChange={(event) => setCurrentBalanceStr(event.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O valor que está no extrato do banco agora.
            </p>
          </div>

          <dl className="space-y-1.5 rounded-lg border border-border/60 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Baixas registradas</dt>
              <dd className="tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(account.settledIn)}
                </span>{" "}
                <span className="text-red-600 dark:text-red-400">
                  −{formatCurrency(account.settledOut)}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Saldo inicial resultante</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(nextOpeningBalance)}</dd>
            </div>
            {difference !== 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5">
                <dt className="text-muted-foreground">Diferença para o calculado</dt>
                <dd
                  className={`font-medium tabular-nums ${
                    difference > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {difference > 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(difference))}
                </dd>
              </div>
            )}
          </dl>

          <p className="text-xs text-muted-foreground">
            O saldo inicial é o que alimenta a abertura da projeção. Ajustá-lo aqui mantém o
            saldo calculado igual ao extrato sem mexer em nenhum lançamento.
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateAccount.isPending}
              className="flex-1 bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90"
            >
              {updateAccount.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
