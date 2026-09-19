"use client";

import { Landmark, PiggyBank, Wallet, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePaymentAccounts } from "../../hooks/use-payment";
import { formatCurrency } from "../../lib/format";

type AccountType = "CHECKING" | "SAVINGS" | "CASH" | "DIGITAL";

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  DIGITAL: "Conta digital",
};

const ACCOUNT_TYPE_ICON: Record<AccountType, typeof Wallet> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CASH: Wallet,
  DIGITAL: Smartphone,
};

export function CashBalanceCard() {
  const { data, isLoading } = usePaymentAccounts();
  const accounts = data?.accounts ?? [];
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sky-500">
          <Wallet className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Valor atual no caixa
          </span>
        </div>

        <p className="mt-2 text-2xl font-black tabular-nums">
          {formatCurrency(total)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Soma do saldo das contas ativas
        </p>

        {isLoading ? (
          <div className="mt-4 h-16 animate-pulse rounded-lg bg-muted/40" />
        ) : accounts.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Nenhuma conta cadastrada. Cadastre em Contas para acompanhar o caixa.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/40">
            {accounts.map((account) => {
              const Icon = ACCOUNT_TYPE_ICON[account.type as AccountType] ?? Wallet;
              return (
                <li key={account.id} className="flex items-center gap-3 py-2">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${account.color ?? "#38bdf8"}20` }}
                  >
                    <Icon className="size-4" style={{ color: account.color ?? "#38bdf8" }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {account.name}
                      {account.isDefault && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">(padrão)</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {ACCOUNT_TYPE_LABEL[account.type as AccountType] ?? account.type}
                      {account.bankName ? ` · ${account.bankName}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      account.balance < 0 ? "text-red-400" : ""
                    }`}
                  >
                    {formatCurrency(account.balance)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
