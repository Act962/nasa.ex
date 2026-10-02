"use client";

import { Info, Landmark, Tags } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetAccountingMapping } from "@/features/accounting/hooks/use-accounting-ledger";
import { usePaymentAccounts, usePaymentCategories } from "@/features/payment/hooks/use-payment";
import {
  SYSTEM_ACCOUNT_KEYS,
  type AccountingNatureCode,
} from "@/features/accounting/lib/chart-of-accounts/default-chart";
import type { ChartAccountRow } from "./account-dialogs";
import { compareAccountCodes, toErrorMessage } from "./account-code";

const SYSTEM_DEFAULT_VALUE = "__system_default__";

type MappingSourceType = "CATEGORY" | "BANK_ACCOUNT";

interface MappingRow {
  sourceType: string;
  sourceId: string;
  accountId: string;
}

interface AccountingMappingProps {
  accounts: ChartAccountRow[];
  mappings: MappingRow[];
}

const CATEGORY_TYPE_LABELS: Record<"REVENUE" | "EXPENSE" | "COST", string> = {
  REVENUE: "Receita",
  EXPENSE: "Despesa",
  COST: "Custo",
};

const DEFAULT_SYSTEM_KEY_BY_NATURE: Partial<Record<AccountingNatureCode, string>> = {
  REVENUE: SYSTEM_ACCOUNT_KEYS.revenueDefault,
  EXPENSE: SYSTEM_ACCOUNT_KEYS.expenseDefault,
  COST: SYSTEM_ACCOUNT_KEYS.costDefault,
  ASSET: SYSTEM_ACCOUNT_KEYS.bankDefault,
};

/** Liga categorias e contas bancárias do financeiro às contas do plano. */
export function AccountingMapping({ accounts, mappings }: AccountingMappingProps) {
  const categories = usePaymentCategories();
  const bankAccounts = usePaymentAccounts();
  const setMapping = useSetAccountingMapping();

  const analyticalAccounts = accounts
    .filter((account) => account.isAnalytical && account.isActive)
    .sort((first, second) => compareAccountCodes(first.code, second.code));

  function findMappedAccountId(sourceType: MappingSourceType, sourceId: string): string {
    const mapping = mappings.find((row) => row.sourceType === sourceType && row.sourceId === sourceId);
    return mapping?.accountId ?? SYSTEM_DEFAULT_VALUE;
  }

  function handleChange(sourceType: MappingSourceType, sourceId: string, selectedValue: string) {
    setMapping.mutate(
      { sourceType, sourceId, accountId: selectedValue === SYSTEM_DEFAULT_VALUE ? null : selectedValue },
      {
        onSuccess: () => toast.success("Mapeamento salvo. A contabilidade está sendo refeita em segundo plano."),
        onError: (error) => toast.error(toErrorMessage(error, "Não foi possível salvar o mapeamento.")),
      },
    );
  }

  function isRowSaving(sourceId: string): boolean {
    return setMapping.isPending && setMapping.variables?.sourceId === sourceId;
  }

  function renderSelect(sourceType: MappingSourceType, sourceId: string, nature: AccountingNatureCode) {
    const compatibleAccounts = analyticalAccounts.filter((account) => account.nature === nature);
    const systemDefaultKey = DEFAULT_SYSTEM_KEY_BY_NATURE[nature];
    const systemDefaultAccount = accounts.find((account) => account.systemKey === systemDefaultKey);
    return (
      <div className="flex items-center gap-2">
        <Select
          value={findMappedAccountId(sourceType, sourceId)}
          onValueChange={(selectedValue) => handleChange(sourceType, sourceId, selectedValue)}
          disabled={isRowSaving(sourceId)}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SYSTEM_DEFAULT_VALUE}>
              Padrão do sistema{systemDefaultAccount ? ` (${systemDefaultAccount.name})` : ""}
            </SelectItem>
            {compatibleAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.code} · {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isRowSaving(sourceId) && <OrbitaSpinner className="size-4 shrink-0 text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="flex gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Aqui você escolhe em qual conta contábil cai cada categoria e cada banco do financeiro. Sem escolha, vale o
        padrão do sistema. Ao mudar, toda a contabilidade é refeita em segundo plano — os relatórios se atualizam em
        alguns instantes.
      </p>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Tags className="size-4 text-info" />
          Categorias do financeiro
        </p>
        {categories.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : categories.isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar as categorias.</p>
        ) : (categories.data?.categories.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma categoria criada ainda. Crie categorias em Receita e Despesa para escolher a conta de cada uma.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {categories.data?.categories.map((category) => (
              <li key={category.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{category.name}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {CATEGORY_TYPE_LABELS[category.type]}
                  </Badge>
                </div>
                {renderSelect("CATEGORY", category.id, category.type)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Landmark className="size-4 text-info" />
          Contas bancárias
        </p>
        {bankAccounts.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : bankAccounts.isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar as contas bancárias.</p>
        ) : (bankAccounts.data?.accounts.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma conta bancária cadastrada. Cadastre em Contas no financeiro.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {bankAccounts.data?.accounts.map((bankAccount) => (
              <li key={bankAccount.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bankAccount.name}</p>
                  {bankAccount.bankName && <p className="truncate text-xs text-muted-foreground">{bankAccount.bankName}</p>}
                </div>
                {renderSelect("BANK_ACCOUNT", bankAccount.id, "ASSET")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
