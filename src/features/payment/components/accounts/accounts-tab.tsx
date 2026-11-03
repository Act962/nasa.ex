"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Landmark, MoreHorizontal, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { describePaymentError } from "../../lib/describe-error";
import {
  usePaymentAccounts,
  useCreatePaymentAccount,
  useDeletePaymentAccount,
} from "../../hooks/use-payment";
import { ACCOUNT_TYPE_LABELS, formatCurrency } from "../../lib/format";
import { BankPicker } from "./bank-picker";
import { AccountBalanceDialog, type AdjustableAccount } from "./account-balance-dialog";
import { BankConnectionSheet, type BankConnectionAccount } from "./bank-connection-sheet";
import { BankConnectionStatusBadge } from "./bank-connection-status";
import { findBankProvider, type BankProviderId } from "../../lib/bank-providers";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

type AccountType = "CHECKING" | "SAVINGS" | "CASH" | "DIGITAL";

export function AccountsTab() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [balance, setBalance] = useState("");
  const [accountToAdjust, setAccountToAdjust] = useState<AdjustableAccount | null>(null);
  const [bankSheet, setBankSheet] = useState<{ accountId: string; provider: BankProviderId } | null>(null);

  const { data } = usePaymentAccounts();
  const createAccount = useCreatePaymentAccount();
  const removeAccount = useDeletePaymentAccount();

  const accounts = data?.accounts ?? [];
  // `balance` é o saldo inicial digitado; `computedBalance` já soma as baixas
  // registradas. Mostrar os dois é o que explica a diferença para o extrato.
  const totalComputed = accounts.reduce(
    (sum, account) => sum + account.computedBalance,
    0,
  );
  const totalOpening = accounts.reduce((sum, account) => sum + account.balance, 0);
  // Conta de banco com API ainda sem conexão: o convite aparece até a primeira ser conectada.
  const hasAnyBankConnection = accounts.some((account) => account.bankConnection);
  const connectableAccount = hasAnyBankConnection
    ? null
    : accounts.find((account) => findBankProvider(account));
  const connectableProvider = connectableAccount ? findBankProvider(connectableAccount) : null;
  const bankSheetAccount: BankConnectionAccount | null = bankSheet
    ? accounts.find((account) => account.id === bankSheet.accountId) ?? null
    : null;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");
    const balanceCents =
      Math.round(parseFloat(balance.replace(",", ".")) * 100) || 0;
    try {
      await createAccount.mutateAsync({
        name,
        bankName: bankName || undefined,
        bankCode: bankCode || undefined,
        type,
        balance: balanceCents,
      });
      setShowForm(false);
      setName("");
      setBankName("");
      setBankCode("");
      setBalance("");
      toast.success("Conta criada!");
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível criar a conta"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Saldo calculado</p>
          <p
            className={`text-2xl font-black tabular-nums ${
              totalComputed >= 0
                ? "text-success dark:text-success"
                : "text-destructive dark:text-destructive"
            }`}
          >
            {formatCurrency(totalComputed)}
          </p>
          <p className="text-xs text-muted-foreground">
            Saldo inicial {formatCurrency(totalOpening)} + baixas registradas
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="h-9 w-full gap-1.5 bg-info text-white hover:bg-info/90 sm:w-auto"
        >
          <Plus className="size-4" />
          Nova conta
        </Button>
      </div>

      {connectableAccount && connectableProvider && (
        <div className="flex flex-col gap-3 rounded-xl border border-info/30 bg-info/5 p-4 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info/15">
            <Zap className="size-5 text-info" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Receba PIX com baixa automática</p>
            <p className="text-xs text-muted-foreground">
              Conecte a conta {connectableAccount.name} ao {connectableProvider.name}: cada cobrança ganha um PIX próprio e a conta é
              baixada sozinha quando o cliente paga.
            </p>
          </div>
          <Button
            data-guide={GUIDE_ANCHORS.paymentBankConnect.id}
            onClick={() => setBankSheet({ accountId: connectableAccount.id, provider: connectableProvider.id })}
            className="h-9 shrink-0 gap-1.5 bg-info text-white hover:bg-info/90"
          >
            Conectar
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {accounts.map((account) => {
          const bankProvider = account.bankConnection?.provider ?? findBankProvider(account)?.id ?? null;
          return (
          <div
            key={account.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-muted/30 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: account.color ?? "#1E90FF" }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                  {account.bankName
                    ? ` • ${account.bankCode ? `${account.bankCode} ` : ""}${account.bankName}`
                    : ""}
                </p>
                {account.bankConnection && (
                  <button
                    type="button"
                    className="mt-1"
                    data-guide={GUIDE_ANCHORS.paymentBankConnectionBadge.id}
                    onClick={() => bankProvider && setBankSheet({ accountId: account.id, provider: bankProvider })}
                  >
                    <BankConnectionStatusBadge
                      provider={account.bankConnection.provider}
                      status={account.bankConnection.status}
                    />
                  </button>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="text-right">
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    account.computedBalance >= 0
                      ? "text-success dark:text-success"
                      : "text-destructive dark:text-destructive"
                  }`}
                >
                  {formatCurrency(account.computedBalance)}
                </span>
                {account.isDefault && (
                  <Badge
                    variant="outline"
                    className="ml-2 hidden border-info/30 text-xs text-info sm:inline-flex"
                  >
                    Padrão
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  inicial {formatCurrency(account.balance)} · entrou{" "}
                  {formatCurrency(account.settledIn)} · saiu{" "}
                  {formatCurrency(account.settledOut)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Ações de ${account.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {bankProvider && (
                    <DropdownMenuItem
                      onClick={() => setBankSheet({ accountId: account.id, provider: bankProvider })}
                      className="gap-2"
                    >
                      <Zap className="size-3.5" />
                      {account.bankConnection ? "Conexão com o banco" : "Conectar banco (PIX automático)"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setAccountToAdjust(account)}
                    className="gap-2"
                  >
                    <Pencil className="size-3.5" /> Ajustar saldo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => removeAccount.mutate({ id: account.id })}
                    className="gap-2 text-destructive"
                  >
                    <Trash2 className="size-3.5" /> Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Landmark className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada
            </p>
          </div>
        )}
      </div>

      <AccountBalanceDialog
        account={accountToAdjust}
        onClose={() => setAccountToAdjust(null)}
      />

      <BankConnectionSheet
        account={bankSheetAccount}
        provider={bankSheet?.provider ?? "INTER"}
        onClose={() => setBankSheet(null)}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova conta bancária</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Conta Principal"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as AccountType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <BankPicker
                  bankName={bankName}
                  bankCode={bankCode}
                  onChange={(value) => {
                    setBankName(value.bankName);
                    setBankCode(value.bankCode);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo inicial (R$)</Label>
              <Input
                placeholder="0,00"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createAccount.isPending}
                className="flex-1 bg-info text-white"
              >
                {createAccount.isPending ? "..." : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
