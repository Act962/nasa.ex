"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Rocket,
  ArrowRight,
  ChevronLeft,
  Star,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useCanManageBilling } from "@/features/billing/hooks/use-can-manage-billing";

export default function SubscriptionConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planSlug = searchParams.get("plan");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageBilling = useCanManageBilling();

  // Guard: members/moderadores não podem assinar pela empresa — só owner/admin.
  // Detalhes em [docs/subscription-org-model.md].
  useEffect(() => {
    if (!canManageBilling) {
      router.replace("/home");
    }
  }, [canManageBilling, router]);

  // Fetch active subscriptions to see if user is already a subscriber
  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["activeSubscriptionsConfirm"],
    queryFn: async () => {
      const { data } = await authClient.subscription.list();
      return data;
    },
  });

  const hasActiveSub = subData && subData.length > 0;

  // Fetch plans to find the details of the selected one
  const { data, isLoading } = useQuery(orpc.public.listPlans.queryOptions());

  const plan = data?.plans.find((p) => p.slug === planSlug);

  const handleCheckout = async () => {
    if (!plan || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (hasActiveSub) {
        // Redir to Billing Portal
        const { data: portalData, error: portalError } =
          await authClient.subscription.billingPortal({
            returnUrl: window.location.origin + "/home",
          });

        if (portalError) throw new Error(portalError.message);
        if (portalData?.url) {
          window.location.href = portalData.url;
        }
        return;
      }

      await authClient.subscription.upgrade({
        plan: plan.name.toLowerCase(),
        successUrl: `${window.location.origin}/home`,
        cancelUrl: window.location.href,
      });
    } catch (error: any) {
      console.error("Checkout error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <OrbitaSpinner className="size-8 text-info mb-4" />
        <p className="text-muted-foreground animate-pulse">
          Preparando seu lançamento...
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6 border border-destructive/20">
          <Zap className="size-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">
          Plano não encontrado
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          Não conseguimos identificar o plano selecionado. Por favor, volte e
          escolha novamente.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          className="border-line text-foreground hover:bg-foreground/5"
        >
          Voltar para Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4 py-12 sm:p-8">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-info/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-info/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-xl w-full relative z-10">
        <div className="mb-8 flex items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-info flex items-center justify-center shadow-lg shadow-info/20">
            <Rocket className="size-6 text-white" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-3 tracking-tight">
            Quase lá,{" "}
            <span className="text-info">
              Pronto para decolar?
            </span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Você selecionou o plano{" "}
            <span className="text-foreground font-bold">{plan.name}</span>. Revise os
            detalhes abaixo para finalizar sua assinatura.
          </p>
        </div>

        {/* Plan Summary Card */}
        <div className="bg-card backdrop-blur-xl border border-line rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden group">
          {/* Subtle Shimmer */}
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-foreground/2 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-foreground">{plan.name}</h2>
              <p className="text-muted-foreground text-xs mt-1">{plan.slogan}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-foreground">
                R$ {plan.priceMonthly}
              </span>
              <p className="text-muted-foreground text-[10px]">por mês</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-foreground/3 border border-line">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Star className="size-4 text-warning fill-warning" />
              </div>
              <div>
                <p className="text-foreground font-bold text-sm">
                  {plan.monthlyStars.toLocaleString()} Stars inclusas
                </p>
                <p className="text-muted-foreground text-[10px]">
                  Seu crédito mensal para o ecossistema
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {plan.benefits.slice(0, 4).map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 flex flex-col gap-3">
            <Button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full font-black py-6 group"
            >
              {isSubmitting ? (
                <OrbitaSpinner className="size-5 mr-2" />
              ) : hasActiveSub ? (
                <>
                  Gerenciar assinatura atual
                  <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  Finalizar assinatura
                  <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => router.push("/home")}
              className="w-full text-muted-foreground hover:text-foreground py-4 text-xs font-semibold"
            >
              Pular assinatura por enquanto
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-6 opacity-30">
          <div className="flex items-center gap-1.5 grayscale">
            <ShieldCheck className="size-3 text-foreground" />
            <span className="text-[10px] text-foreground font-bold uppercase tracking-widest">
              Safe Checkout
            </span>
          </div>
          <div className="w-px h-3 bg-foreground/20" />
          <div className="flex items-center gap-1.5 grayscale">
            <span className="text-[10px] text-foreground font-bold uppercase tracking-widest italic">
              Stripe Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
