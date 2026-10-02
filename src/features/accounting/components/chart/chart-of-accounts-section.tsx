"use client";

import { useMemo, useState } from "react";
import { ListTree, Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAccountingChart } from "@/features/accounting/hooks/use-accounting-ledger";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { EditAccountDialog, NewAccountDialog, type ChartAccountRow } from "./account-dialogs";
import { AccountingMapping } from "./accounting-mapping";
import { NATURE_BADGE_CLASSES, NATURE_LABELS, accountDepth, compareAccountCodes } from "./account-code";

const INDENT_PER_LEVEL_PX = 14;

/** Seção "Plano de contas": árvore de contas e mapeamento do financeiro. */
export function ChartOfAccountsSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const chart = useAccountingChart();
  const [searchText, setSearchText] = useState("");
  const [shouldShowInactive, setShouldShowInactive] = useState(false);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccountRow | null>(null);

  const accounts = useMemo(() => chart.data?.accounts ?? [], [chart.data]);
  const visibleAccounts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return [...accounts]
      .filter((account) => shouldShowInactive || account.isActive)
      .filter(
        (account) =>
          !normalizedSearch ||
          account.code.startsWith(normalizedSearch) ||
          account.name.toLowerCase().includes(normalizedSearch),
      )
      .sort((first, second) => compareAccountCodes(first.code, second.code));
  }, [accounts, searchText, shouldShowInactive]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-info/5 p-4 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <ListTree className="size-4 text-info" />
          Plano de contas
          <FiscalTermHint termId="plano-de-contas" />
        </p>
        <p className="mt-1.5 text-muted-foreground">
          É a lista de “gavetas” da contabilidade da empresa. Você não precisa lançar nada aqui: cada receita, despesa e
          pagamento do financeiro vira automaticamente um lançamento em{" "}
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            partidas dobradas
            <FiscalTermHint termId="partida-dobrada" />
          </span>{" "}
          — o valor sai de uma conta e entra em outra.
        </p>
        {onNavigate && (
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0 text-info" onClick={() => onNavigate("reports")}>
            Ver balancete e balanço
          </Button>
        )}
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="mapping">Mapeamento</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar por código ou nome"
                className="pl-9"
                aria-label="Buscar conta"
              />
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="flex items-center gap-2">
                <Switch id="show-inactive-accounts" checked={shouldShowInactive} onCheckedChange={setShouldShowInactive} />
                <Label htmlFor="show-inactive-accounts" className="text-xs text-muted-foreground">
                  Mostrar inativas
                </Label>
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-info text-white hover:bg-info"
                onClick={() => setIsNewDialogOpen(true)}
              >
                <Plus className="size-4" />
                Nova conta
              </Button>
            </div>
          </div>

          {chart.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          )}

          {chart.isError && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Não foi possível carregar o plano de contas.
              <Button type="button" size="sm" variant="outline" onClick={() => chart.refetch()}>
                Tentar de novo
              </Button>
            </div>
          )}

          {!chart.isLoading && !chart.isError && visibleAccounts.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {accounts.length === 0 ? "O plano de contas ainda não foi criado." : "Nenhuma conta encontrada para esse filtro."}
              <div className="mt-3">
                {accounts.length === 0 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => chart.refetch()}>
                    Criar plano padrão
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setSearchText("")}>
                    Limpar busca
                  </Button>
                )}
              </div>
            </div>
          )}

          {visibleAccounts.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {visibleAccounts.map((account) => (
                <li
                  key={account.id}
                  className={cn("flex items-center gap-2 py-2 pr-2", !account.isActive && "opacity-60")}
                  style={{ paddingLeft: 12 + accountDepth(account.code) * INDENT_PER_LEVEL_PX }}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-sm", !account.isAnalytical && "font-semibold")}>
                      <span className="font-mono text-xs text-muted-foreground">{account.code}</span>
                      <span className="break-words">{account.name}</span>
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge variant="outline" className={cn("text-[10px]", NATURE_BADGE_CLASSES[account.nature])}>
                        {NATURE_LABELS[account.nature]}
                      </Badge>
                      {account.systemKey && (
                        <Badge variant="secondary" className="text-[10px]">
                          usada pelo sistema
                        </Badge>
                      )}
                      {!account.isActive && (
                        <Badge variant="outline" className="text-[10px]">
                          inativa
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    aria-label={`Editar conta ${account.code}`}
                    onClick={() => setEditingAccount(account)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="mapping">
          {chart.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <AccountingMapping accounts={accounts} mappings={chart.data?.mappings ?? []} />
          )}
        </TabsContent>
      </Tabs>

      <NewAccountDialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen} accounts={accounts} />
      <EditAccountDialog account={editingAccount} onOpenChange={(isOpen) => !isOpen && setEditingAccount(null)} />
    </div>
  );
}
