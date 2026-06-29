"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Zap, Users } from "lucide-react";
import { StarIcon } from "./star-icon";
import { toast } from "sonner";
import { useCanManageBilling } from "@/features/billing/hooks/use-can-manage-billing";

export interface PlanPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  currentPlanSlug?: string;
  initialPlanSlug?: string;
}

const BILLING_LABEL: Record<string, string> = {
  monthly: "/mês",
  annual: "/ano",
  weekly: "/sem",
};

export function PlanPurchaseModal({
  open,
  onClose,
  currentPlanSlug,
  initialPlanSlug,
}: PlanPurchaseModalProps) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const canManageBilling = useCanManageBilling();

  const { data: plansData, isLoading: plansLoading } = useQuery({
    ...orpc.stars.listPlans.queryOptions(),
    enabled: open,
  });

  const plans = plansData?.plans ?? [];
  const orgHasPlan = !!currentPlanSlug && currentPlanSlug !== "free";

  const goToPortal = async () => {
    try {
      const { data, error } = await authClient.subscription.billingPortal({
        returnUrl: window.location.origin + "/home",
      });
      if (error) throw new Error(error.message || "Falha ao abrir portal");
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal error:", err);
      toast.error("Não foi possível acessar o portal do Stripe agora.");
      setIsRedirecting(false);
    }
  };

  const handleSelectPlan = async (slug: string) => {
    if (isRedirecting) return;
    setIsRedirecting(true);

    if (orgHasPlan) {
      await goToPortal();
      return;
    }

    onClose();
    router.push(`/subscription/confirm?plan=${slug}`);
  };

  useEffect(() => {
    if (!open || !initialPlanSlug || plans.length === 0) return;
    const found = plans.find((plan) => plan.slug === initialPlanSlug);
    if (found) {
      void handleSelectPlan(found.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPlanSlug, plans.length]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setIsRedirecting(false);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a14] border-white/10">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-linear-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Escolha seu plano
              </DialogTitle>
              <p className="text-[11px] text-white/40 mt-0.5">
                Stars são creditados mensalmente e usados para manter
                integrações ativas
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {plansLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-52 rounded-xl bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-center text-sm text-white/40 py-8">
              Nenhum plano disponível no momento.
            </p>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                plans.length <= 2
                  ? "grid-cols-2"
                  : plans.length === 3
                    ? "grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {plans.map((plan) => {
                const isCurrent = currentPlanSlug === plan.slug;
                const billingLabel =
                  BILLING_LABEL[plan.billingType] ?? "/mês";
                const isFree = plan.priceMonthly === 0;
                const disabled =
                  isCurrent || isRedirecting || !canManageBilling;

                return (
                  <button
                    key={plan.id}
                    disabled={disabled}
                    onClick={() => handleSelectPlan(plan.slug)}
                    className={cn(
                      "relative flex flex-col rounded-xl border p-4 text-left transition-all",
                      isCurrent
                        ? "border-emerald-600/50 bg-emerald-950/20 opacity-70 cursor-not-allowed"
                        : plan.highlighted
                          ? "border-[#7C3AED]/40 bg-[#7C3AED]/5 hover:border-[#7C3AED]/70"
                          : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/8",
                      disabled && !isCurrent && "cursor-wait",
                    )}
                  >
                    {plan.highlighted && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-[#7C3AED] text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow-lg">
                          Mais popular
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                          Plano atual
                        </span>
                      </div>
                    )}

                    <p className="text-sm font-bold text-white text-center mb-2 mt-1">
                      {plan.name}
                    </p>

                    <div className="text-center mb-2">
                      {isFree ? (
                        <span className="text-xl font-extrabold text-emerald-400">
                          Grátis
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] text-white/50">R$</span>
                          <span className="text-2xl font-extrabold text-white mx-1 leading-none">
                            {plan.priceMonthly.toLocaleString("pt-BR")}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {billingLabel}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-1 mb-1">
                      <StarIcon className="size-3 shrink-0" />
                      <span className="text-[11px] font-bold text-[#a78bfa]">
                        {plan.monthlyStars.toLocaleString("pt-BR")} ★/mês
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-1 mb-3">
                      <Users className="size-3 text-white/30 shrink-0" />
                      <span className="text-[10px] text-white/40">
                        {plan.maxUsers >= 999_999
                          ? "Ilimitados"
                          : `Até ${plan.maxUsers}`}{" "}
                        usuários
                      </span>
                    </div>

                    <div
                      className={cn(
                        "w-full text-center text-[11px] font-bold py-1.5 rounded-lg mt-auto",
                        isCurrent
                          ? "bg-emerald-700/40 text-emerald-300"
                          : plan.highlighted
                            ? "bg-[#7C3AED]/80 text-white"
                            : "bg-white/10 text-white",
                      )}
                    >
                      {isCurrent ? (
                        "Plano atual"
                      ) : !canManageBilling ? (
                        "Apenas owner/admin"
                      ) : isRedirecting ? (
                        <>
                          <Loader2 className="inline size-3 mr-1 animate-spin" />
                          Redirecionando…
                        </>
                      ) : orgHasPlan ? (
                        <>
                          <Zap className="inline size-3 mr-1" />
                          Trocar plano
                        </>
                      ) : (
                        <>
                          <Zap className="inline size-3 mr-1" />
                          Adquirir plano
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-center text-[11px] text-white/25 pt-1">
            🔒 Pagamento seguro via Stripe — cancele quando quiser, sem multas
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
