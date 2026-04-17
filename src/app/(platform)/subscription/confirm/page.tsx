"use client";

import { useState } from "react";
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
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SubscriptionConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planSlug = searchParams.get("plan");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <div className="min-h-screen bg-[#0a0715] flex flex-col items-center justify-center p-4">
        <Loader2 className="size-8 text-violet-500 animate-spin mb-4" />
        <p className="text-white/40 animate-pulse">
          Preparando seu lançamento...
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#0a0715] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
          <Zap className="size-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">
          Plano não encontrado
        </h1>
        <p className="text-white/40 mb-8 max-w-md">
          Não conseguimos identificar o plano selecionado. Por favor, volte e
          escolha novamente.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          className="border-white/10 text-white hover:bg-white/5"
        >
          Voltar para Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0715] relative overflow-hidden flex flex-col items-center justify-center p-4 py-12 sm:p-8">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-xl w-full relative z-10">
        <div className="mb-8 flex items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Rocket className="size-6 text-white" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">
            Quase lá,{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-fuchsia-400">
              Pronto para decolar?
            </span>
          </h1>
          <p className="text-white/40 text-sm sm:text-base">
            Você selecionou o plano{" "}
            <span className="text-white font-bold">{plan.name}</span>. Revise os
            detalhes abaixo para finalizar sua assinatura.
          </p>
        </div>

        {/* Plan Summary Card */}
        <div className="bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden group">
          {/* Subtle Shimmer */}
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/2 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-white">{plan.name}</h2>
              <p className="text-white/40 text-xs mt-1">{plan.slogan}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white">
                R$ {plan.priceMonthly}
              </span>
              <p className="text-white/30 text-[10px]">por mês</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/3 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                <Star className="size-4 text-yellow-400 fill-yellow-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">
                  {plan.monthlyStars.toLocaleString()} Stars inclusas
                </p>
                <p className="text-white/30 text-[10px]">
                  Seu crédito mensal para o ecossistema
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {plan.benefits.slice(0, 4).map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-white/60"
                >
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
            <Button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-black py-6 rounded-2xl shadow-xl shadow-violet-600/20 group transition-all"
            >
              {isSubmitting ? (
                <Loader2 className="size-5 animate-spin mr-2" />
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
              className="w-full text-white/30 hover:text-white/60 hover:bg-white/5 py-4 rounded-xl text-xs font-semibold"
            >
              Pular assinatura por enquanto
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-6 opacity-30">
          <div className="flex items-center gap-1.5 grayscale">
            <ShieldCheck className="size-3 text-white" />
            <span className="text-[10px] text-white font-bold uppercase tracking-widest">
              Safe Checkout
            </span>
          </div>
          <div className="w-px h-3 bg-white/20" />
          <div className="flex items-center gap-1.5 grayscale">
            <span className="text-[10px] text-white font-bold uppercase tracking-widest italic">
              Stripe Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
