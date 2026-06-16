"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StarIcon } from "./star-icon";
import { Loader2, Sparkles, Users, ExternalLink, Zap } from "lucide-react";

interface PlanSelectModalProps {
  open: boolean;
  onClose: () => void;
}

const BILLING_LABEL: Record<string, string> = {
  monthly: "/mês",
  annual: "/ano",
  weekly: "/sem",
};

export function PlanSelectModal({ open, onClose }: PlanSelectModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.stars.listPlans.queryOptions(),
    enabled: open,
  });

  const plans = data?.plans ?? [];

  const handleChoose = async (plan: (typeof plans)[number]) => {
    if (loadingId) return;

    if (plan.ctaLink) {
      window.open(plan.ctaLink, "_blank");
      return;
    }

    if (plan.ctaGatewayId) {
      setLoadingId(plan.id);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            planSlug: plan.slug,
            mode: "subscription",
            itemType: "plan",
            itemSlug: plan.slug,
          }),
        });
        const json = await res.json();
        if (json.url) {
          window.location.href = json.url;
        } else {
          alert("Gateway de pagamento não configurado. Contate o suporte.");
        }
      } finally {
        setLoadingId(null);
      }
      return;
    }

    window.open(
      "mailto:vendas@nasaex.com.br?subject=Plano " + plan.name,
      "_blank",
    );
  };

  // Determine grid columns based on plan count
  const colClass =
    plans.length <= 1
      ? "grid-cols-1 max-w-xs mx-auto"
      : plans.length === 2
        ? "grid-cols-2"
        : plans.length === 3
          ? "grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a14] border-white/10">
        {/* Header */}
        <DialogHeader className="pb-1">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-linear-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center shrink-0">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Escolha seu plano
              </DialogTitle>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                Stars são creditados mensalmente e usados para manter
                integrações ativas
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Plans grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 py-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-52 rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/40">
            Nenhum plano disponível no momento.
          </div>
        ) : (
          <div className={cn("grid gap-3 py-1", colClass)}>
            {plans.map((plan) => {
              const busy = loadingId === plan.id;
              const billingLabel = BILLING_LABEL[plan.billingType] ?? "/mês";
              const isFree = plan.priceMonthly === 0;

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-4 transition-all",
                    plan.highlighted
                      ? "border-[#7C3AED]/60 bg-[#7C3AED]/8 shadow-[0_0_24px_rgba(124,58,237,.15)]"
                      : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/6",
                  )}
                >
                  {/* Popular badge */}
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-[#7C3AED] text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow-lg">
                        Mais popular
                      </span>
                    </div>
                  )}

                  {/* Plan name */}
                  <p className="text-sm font-bold text-white text-center mb-3 mt-1">
                    {plan.name}
                  </p>

                  {/* Price */}
                  <div className="text-center mb-3">
                    {isFree ? (
                      <div className="text-2xl font-extrabold text-white">
                        R$ 0
                        <span className="text-xs text-white/40 font-normal">
                          {billingLabel}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[11px] text-white/50 font-medium">
                          R$
                        </span>
                        <span className="text-3xl font-extrabold text-white mx-1 leading-none">
                          {plan.priceMonthly.toLocaleString("pt-BR", {
                            minimumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-[11px] text-white/40">
                          {billingLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stars */}
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <StarIcon className="size-3.5 shrink-0" />
                    <span
                      className={cn(
                        "text-[12px] font-bold",
                        plan.highlighted ? "text-[#a78bfa]" : "text-[#7C3AED]",
                      )}
                    >
                      {plan.monthlyStars.toLocaleString("pt-BR")} stars/mês
                    </span>
                  </div>

                  {/* Users */}
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    <Users className="size-3 text-white/30 shrink-0" />
                    <span className="text-[11px] text-white/40">
                      {plan.maxUsers >= 999_999
                        ? "Usuários ilimitados"
                        : `Até ${plan.maxUsers} usuários`}
                    </span>
                  </div>

                  {/* CTA */}
                  <Button
                    size="sm"
                    disabled={!!loadingId}
                    onClick={() => handleChoose(plan)}
                    className={cn(
                      "w-full mt-auto gap-1.5 font-semibold text-xs rounded-lg h-8",
                      plan.highlighted
                        ? "bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/20"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/10",
                    )}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Aguarde...
                      </>
                    ) : plan.ctaLink ? (
                      <>
                        <ExternalLink className="size-3.5" /> {plan.ctaLabel}
                      </>
                    ) : (
                      <>
                        <Zap className="size-3.5" /> {plan.ctaLabel}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-white/25 pt-1 pb-0.5">
          🔒 Pagamento seguro — cancele quando quiser, sem multas
        </p>
      </DialogContent>
    </Dialog>
  );
}
