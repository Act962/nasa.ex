"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, CreditCard, Zap, Ticket } from "lucide-react";
import { StarIcon } from "./star-icon";
import { toast } from "sonner";
import {
  useStarsBalance,
  useStarsPricing,
  useCreateStarsCheckout,
} from "../hooks/use-stars-purchase";

interface StarsPurchaseModalProps {
  open: boolean;
  onClose: () => void;
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function StarsPurchaseModal({ open, onClose }: StarsPurchaseModalProps) {
  const { data: balanceData } = useStarsBalance();
  const { data: pricing, isLoading: pricingLoading } = useStarsPricing();
  const { mutate: createCheckout, isPending } = useCreateStarsCheckout();

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customRaw, setCustomRaw] = useState("");

  const balance = balanceData?.balance ?? 0;
  const starPriceBrl = pricing?.starPriceBrl ?? 0.15;
  const minStars = pricing?.minStars ?? 34;
  const maxStars = pricing?.maxStars ?? 1_000_000;
  const presets = pricing?.presets ?? [];

  const customStars = customRaw ? parseInt(customRaw, 10) : 0;
  const stars =
    customStars > 0 ? customStars : (selectedPreset ?? 0);
  const totalBrl = stars * starPriceBrl;
  const belowMin = stars > 0 && stars < minStars;
  const aboveMax = stars > maxStars;
  const canBuy = stars >= minStars && stars <= maxStars && !isPending;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setSelectedPreset(null);
      setCustomRaw("");
    }, 300);
  };

  const handleSelectPreset = (value: number) => {
    setSelectedPreset(value);
    setCustomRaw("");
  };

  const handleCustomChange = (raw: string) => {
    setCustomRaw(raw.replace(/\D/g, ""));
    setSelectedPreset(null);
  };

  const handleBuy = () => {
    if (!canBuy) return;
    createCheckout(
      { stars, returnPath: window.location.pathname },
      {
        onSuccess: (r) => {
          window.location.href = r.checkoutUrl;
        },
        onError: (e) =>
          toast.error(e.message ?? "Erro ao iniciar o pagamento."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
              <StarIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Adquirir Stars</DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                Saldo atual: <strong>{balance.toLocaleString("pt-BR")} ★</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stars não expiram. R$ {starPriceBrl.toFixed(2).replace(".", ",")} por ★.
          </p>

          {/* ── Presets ───────────────────────────────────────────────── */}
          {pricingLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {presets.map((value) => {
                const isSelected = selectedPreset === value && !customRaw;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSelectPreset(value)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-2 transition-all",
                      isSelected
                        ? "border-[#7C3AED] bg-[#7C3AED]/5"
                        : "border-border hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5",
                    )}
                  >
                    <span className="flex items-center gap-0.5 text-sm font-bold">
                      <StarIcon className="size-3" />
                      {value.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatBrl(value * starPriceBrl)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Custom amount ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Ou escolha a quantidade
            </label>
            <div className="relative">
              <StarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" />
              <Input
                inputMode="numeric"
                placeholder={`mín. ${minStars.toLocaleString("pt-BR")}`}
                value={customRaw}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="pl-8"
              />
            </div>
            {belowMin && (
              <p className="text-[11px] text-red-500">
                Mínimo de {minStars.toLocaleString("pt-BR")} ★ ({formatBrl(
                  (pricing?.minBrlCents ?? 500) / 100,
                )}).
              </p>
            )}
            {aboveMax && (
              <p className="text-[11px] text-red-500">
                Máximo de {maxStars.toLocaleString("pt-BR")} ★ por compra.
              </p>
            )}
          </div>

          {/* ── Total + CTA ───────────────────────────────────────────── */}
          {stars > 0 && !belowMin && !aboveMax && (
            <div className="flex items-center justify-between rounded-xl bg-muted/50 border border-border p-3">
              <span className="flex items-center gap-1 text-sm font-medium">
                <StarIcon className="size-4" />
                {stars.toLocaleString("pt-BR")}
              </span>
              <span className="font-bold text-sm">{formatBrl(totalBrl)}</span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 dark:bg-blue-950/20 dark:border-blue-900/50">
            <Zap className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              As Stars são creditadas automaticamente após a confirmação do
              pagamento.
            </p>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Ticket className="size-3.5 shrink-0" />
            Tem um cupom? Aplique na etapa de pagamento.
          </p>

          <Button
            onClick={handleBuy}
            disabled={!canBuy}
            className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Abrindo checkout…
              </>
            ) : (
              <>
                <CreditCard className="size-4" /> Comprar com cartão
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
