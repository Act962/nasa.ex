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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Rocket,
  ArrowRight,
  Star,
  Zap,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface SubscriptionPlansModalProps {
  open: boolean;
  onClose: () => void;
  currentPlanSlug?: string;
}

export function SubscriptionPlansModal({
  open,
  onClose,
  currentPlanSlug,
}: SubscriptionPlansModalProps) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: plansData, isLoading: plansLoading } = useQuery({
    ...orpc.stars.listPlans.queryOptions(),
    enabled: open,
  });

  const { data: activeSubscriptions } = useQuery({
    queryKey: ["activeSubscriptions"],
    queryFn: async () => {
      const { data } = await authClient.subscription.list();
      return data;
    },
    enabled: open,
  });

  const plans = plansData?.plans ?? [];
  const activePlanNames = activeSubscriptions?.map((s) => s.plan) ?? [];

  const handleOpenPortal = async () => {
    setIsRedirecting(true);
    try {
      const { data, error } = await authClient.subscription.billingPortal({
        returnUrl: window.location.origin + "/home",
      });

      if (error) {
        throw new Error(error.message || "Falha ao criar sessão do portal");
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal Error:", err);
      toast.error("Não foi possível acessar o portal do Stripe agora.");
      setIsRedirecting(false);
    }
  };

  const handleSelectPlan = async (slug: string) => {
    // If user already has an active subscription, send them to billing portal
    if (activePlanNames.length > 0) {
      await handleOpenPortal();
      return;
    }

    onClose();
    router.push(`/subscription/confirm?plan=${slug}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl bg-background border-border/40 text-foreground overflow-hidden p-0 shadow-2xl">
        <div className="relative p-6 sm:p-8">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

          <DialogHeader className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-linear-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">
                  Eleve sua <span className="text-primary">Operação</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Escolha o melhor plano para escalar seu ecossistema.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-64 rounded-2xl bg-muted/20 animate-pulse border border-border/50"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
              {plans.map((plan) => {
                const planNameLower = plan.name.toLowerCase();
                const isCurrent =
                  activePlanNames.includes(planNameLower) ||
                  currentPlanSlug === plan.slug;
                const isFree = plan.priceMonthly === 0;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "group relative flex flex-col rounded-2xl border p-5 transition-all duration-300",
                      isCurrent
                        ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                        : plan.highlighted
                          ? "border-primary/40 bg-primary/5 hover:border-primary/60 shadow-[0_0_25px_rgba(var(--primary),0.05)]"
                          : "border-border/60 bg-muted/5 hover:border-primary/30 hover:bg-muted/10",
                    )}
                  >
                    {plan.highlighted && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                          Destaque
                        </span>
                      </div>
                    )}

                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                          Atual
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="font-bold text-foreground text-lg tracking-tight">
                        {plan.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold leading-tight mt-1">
                        {plan.slogan || "Potencialize sua empresa"}
                      </p>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-foreground">
                          {isFree ? "Grátis" : `R$ ${plan.priceMonthly}`}
                        </span>
                        {!isFree && (
                          <span className="text-muted-foreground text-[10px]">
                            /mês
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 p-1.5 rounded-lg bg-primary/5 border border-primary/10">
                        <Star className="size-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-[11px] font-bold text-primary">
                          {plan.monthlyStars.toLocaleString("pt-BR")} Stars
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-8 flex-1">
                      {plan.benefits.slice(0, 3).map((benefit, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[10px] text-muted-foreground leading-tight"
                        >
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      disabled={isCurrent || isRedirecting}
                      onClick={() => handleSelectPlan(plan.slug)}
                      className={cn(
                        "w-full h-9 rounded-xl font-bold text-xs gap-2 transition-all",
                        isCurrent
                          ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-not-allowed hover:bg-emerald-600/20"
                          : plan.highlighted
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                            : "bg-muted/30 hover:bg-muted/50 text-foreground border border-border",
                      )}
                    >
                      {isCurrent ? (
                        "Plano Atual"
                      ) : isRedirecting ? (
                        <>
                          Redirecionando...
                          <Spinner />
                        </>
                      ) : (
                        <>
                          Selecionar{" "}
                          <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-muted-foreground/30">
              <div className="flex items-center gap-1.5 text-muted-foreground/50">
                <Rocket className="size-3" />
                <span className="text-[9px] font-bold uppercase tracking-widest leading-none">
                  NASA Ready
                </span>
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-muted-foreground/50">
                <Zap className="size-3" />
                <span className="text-[9px] font-bold uppercase tracking-widest leading-none">
                  Stripe Secure
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[9px] text-muted-foreground/50 text-center sm:text-right italic">
                *Mude ou cancele seu plano a qualquer momento diretamente no
                painel.
              </p>
              <button
                disabled={isRedirecting}
                onClick={handleOpenPortal}
                className="text-[10px] text-primary hover:text-primary/80 transition-colors font-bold uppercase tracking-widest text-center sm:text-right flex items-center justify-center sm:justify-end gap-1 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gerencie sua assinatura
                <ArrowRight className="size-2.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
