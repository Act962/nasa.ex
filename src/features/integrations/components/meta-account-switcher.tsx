"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useActiveMetaAccount,
  useAvailableMetaAccounts,
} from "@/features/integrations/hooks/use-active-meta-account";

const META_INVALIDATION_PREFIXES = [
  ["metaAds"],
  ["insights"],
  ["integrations", "getActiveMetaSelection"],
];

export function MetaAccountSwitcher({ className }: { className?: string }) {
  const qc = useQueryClient();
  const accountsQuery = useAvailableMetaAccounts();
  const active = useActiveMetaAccount();

  const adAccounts = accountsQuery.data?.adAccounts ?? [];
  const activeAccount = useMemo(
    () => adAccounts.find((a) => a.id === active.adAccountId),
    [adAccounts, active.adAccountId],
  );

  const setActive = useMutation(
    orpc.integrations.setActiveMetaAccount.mutationOptions({
      onSuccess: async () => {
        await Promise.all(
          META_INVALIDATION_PREFIXES.map((key) => qc.invalidateQueries({ queryKey: key })),
        );
        toast.success("Conta Meta trocada");
      },
      onError: (err: { message?: string }) => {
        toast.error(err?.message ?? "Erro ao trocar conta Meta");
      },
    }),
  );

  if (accountsQuery.isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className={cn("gap-2", className)}>
        <Loader2 className="size-3.5 animate-spin" />
        Carregando contas…
      </Button>
    );
  }

  if (!accountsQuery.data?.connected || adAccounts.length === 0) {
    return null;
  }

  const triggerLabel = activeAccount?.name ?? active.adAccountId ?? "Selecione a conta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2 max-w-[280px]", className)}>
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px]">
        <DropdownMenuLabel className="text-xs font-medium">
          Contas de anúncios ({adAccounts.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto">
          {adAccounts.map((acc) => {
            const isActive = acc.id === active.adAccountId;
            return (
              <DropdownMenuItem
                key={acc.id}
                disabled={setActive.isPending && setActive.variables?.adAccountId === acc.id}
                onSelect={(e) => {
                  e.preventDefault();
                  if (isActive) return;
                  setActive.mutate({ adAccountId: acc.id });
                }}
                className="flex items-start gap-2 py-2"
              >
                <Check
                  className={cn(
                    "size-4 mt-0.5 shrink-0",
                    isActive ? "opacity-100 text-emerald-600" : "opacity-0",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{acc.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {acc.id}
                    {acc.currency ? ` · ${acc.currency}` : ""}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
