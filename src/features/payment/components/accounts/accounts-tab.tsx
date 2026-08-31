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
import { Landmark, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePaymentAccounts,
  useCreatePaymentAccount,
  useDeletePaymentAccount,
} from "../../hooks/use-payment";
import { ACCOUNT_TYPE_LABELS, formatCurrency } from "../../lib/format";

type AccountType = "CHECKING" | "SAVINGS" | "CASH" | "DIGITAL";

export function AccountsTab() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [balance, setBalance] = useState("");

  const { data } = usePaymentAccounts();
  const createAccount = useCreatePaymentAccount();
  const removeAccount = useDeletePaymentAccount();

  const accounts = data?.accounts ?? [];
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");
    const balanceCents =
      Math.round(parseFloat(balance.replace(",", ".")) * 100) || 0;
    try {
      await createAccount.mutateAsync({
        name,
        bankName: bankName || undefined,
        type,
        balance: balanceCents,
      });
      setShowForm(false);
      setName("");
      setBankName("");
      setBalance("");
      toast.success("Conta criada!");
    } catch {
      toast.error("Erro ao criar conta");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p
            className={`text-2xl font-black tabular-nums ${
              totalBalance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatCurrency(totalBalance)}
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="h-9 w-full gap-1.5 bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90 sm:w-auto"
        >
          <Plus className="size-4" />
          Nova conta
        </Button>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => (
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
                  {account.bankName ? ` • ${account.bankName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="text-right">
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    account.balance >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(account.balance)}
                </span>
                {account.isDefault && (
                  <Badge
                    variant="outline"
                    className="ml-2 hidden border-blue-400/30 text-xs text-blue-400 sm:inline-flex"
                  >
                    Padrão
                  </Badge>
                )}
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
                  <DropdownMenuItem
                    onClick={() => removeAccount.mutate({ id: account.id })}
                    className="gap-2 text-red-500"
                  >
                    <Trash2 className="size-3.5" /> Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

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
                <Input
                  placeholder="Ex: Itaú"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
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
                className="flex-1 bg-[#1E90FF] text-white"
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
