"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Popup com o histórico de consumo de Stars da organização.
 *
 * Antes esse bloco vivia inline em `/configuracoes → Permissões` (visível só
 * pra Master). Foi movido pra cá pra ficar disponível direto do widget de
 * Stars no header — clica em "Histórico de consumo" e abre.
 *
 * Usa `stars.listTransactions` com `consumptionOnly=true` pra trazer apenas
 * débitos (amount<0). Limit 200 = parity com o card antigo.
 */
export function StarsHistoryDialog({ open, onOpenChange }: Props) {
  const q = useQuery({
    ...orpc.stars.listTransactions.queryOptions({
      input: { limit: 200, offset: 0, consumptionOnly: true },
    }),
    enabled: open, // só busca quando o popup abre
    staleTime: 30_000,
  });

  const txs = q.data?.transactions ?? [];
  const total = q.data?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-4 text-yellow-500" />
            Histórico de consumo
          </DialogTitle>
          <DialogDescription>
            Últimos {Math.min(200, total)} débitos de Stars na sua organização
            {total > 200 && (
              <span className="text-muted-foreground"> · {total} no total</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Carregando histórico…
          </div>
        ) : txs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum consumo registrado ainda.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden divide-y max-h-[60vh] overflow-y-auto">
            {txs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {tx.description}
                  </p>
                  {tx.appSlug && (
                    <p className="text-[10px] text-muted-foreground">
                      {tx.appSlug}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs font-bold text-red-500 tabular-nums">
                    {tx.amount.toLocaleString("pt-BR")} ⭐
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
