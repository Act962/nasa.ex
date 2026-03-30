"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react";
import { StarIcon } from "./star-icon";

interface StarsPurchaseModalProps {
  open: boolean;
  onClose: () => void;
}

export function StarsPurchaseModal({ open, onClose }: StarsPurchaseModalProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [starsAdded, setStarsAdded] = useState(0);

  const { data: packagesData, isLoading } = useQuery({
    ...orpc.stars.listPackages.queryOptions(),
    enabled: open,
  });

  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    enabled: open,
  });

  const { mutate: purchase, isPending } = useMutation({
    ...orpc.stars.purchasePackage.mutationOptions(),
    onSuccess: (result) => {
      setStarsAdded(result.starsAdded);
      setDone(true);
      queryClient.invalidateQueries(orpc.stars.getBalance.queryOptions());
      setTimeout(() => {
        handleClose();
      }, 2500);
    },
  });

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setSelected(null);
      setDone(false);
      setStarsAdded(0);
    }, 300);
  };

  const handlePurchase = () => {
    if (!selected) return;
    purchase({ packageId: selected });
  };

  const packages = packagesData?.packages ?? [];
  const balance = balanceData?.balance ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
              <StarIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Comprar Stars</DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                Saldo atual: <strong>{balance.toLocaleString("pt-BR")} ★</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        {done ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-emerald-700">
                +{starsAdded.toLocaleString("pt-BR")} ★ adicionados!
              </p>
              <p className="text-sm text-muted-foreground">
                Novo saldo: {(balance + starsAdded).toLocaleString("pt-BR")} ★
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Stars não expiram após a compra. Use para ativar e manter integrações ativas na plataforma.
            </p>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg) => {
                  const isSelected = selected === pkg.id;
                  const pricePerStar = (pkg.priceBrl / pkg.stars).toFixed(3);
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelected(pkg.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                        isSelected
                          ? "border-[#7C3AED] bg-[#7C3AED]/5"
                          : "border-border hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5"
                      )}
                    >
                      <div className={cn(
                        "size-9 rounded-lg flex items-center justify-center shrink-0",
                        isSelected ? "bg-yellow-100 dark:bg-yellow-900/40" : "bg-muted"
                      )}>
                        <StarIcon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{pkg.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          R$ {pricePerStar}/★
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">
                          R$ {pkg.priceBrl.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 dark:bg-blue-950/20 dark:border-blue-900/50">
              <Zap className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                Stars adquiridas nunca expiram. São cobradas mensalmente pelas integrações ativas.
              </p>
            </div>

            <Button
              onClick={handlePurchase}
              disabled={!selected || isPending}
              className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
            >
              {isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Processando...</>
              ) : (
                <><Sparkles className="size-4" /> Confirmar compra</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
