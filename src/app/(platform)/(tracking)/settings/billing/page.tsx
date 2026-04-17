"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import {
  CreditCard,
  Star,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { SubscriptionPlansModal } from "@/features/stars/components/subscription-plans-modal";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { StarsUsageBar } from "@/features/stars/components/stars-usage-bar";

export default function BillingPage() {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch balance and DB info
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    refetchInterval: 15_000,
  });

  // Fetch active subscriptions from Stripe via Better Auth
  const { data: activeSubscriptions, isLoading: subLoading } = useQuery({
    queryKey: ["activeSubscriptionsBilling"],
    queryFn: async () => {
      const { data } = await authClient.subscription.list();
      return data;
    },
  });

  const activeSub = activeSubscriptions?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );

  const planName = activeSub
    ? activeSub.plan.toUpperCase()
    : (balanceData?.planName ?? "GRÁTIS");
  const planSlug = activeSub
    ? activeSub.plan.toLowerCase()
    : (balanceData?.planSlug ?? "free");

  const {
    used = 0,
    totalLimit = 100,
    extraBalance = 0,
    nextCycleDate,
  } = balanceData || {};

  const remaining = Math.max(0, totalLimit - used);

  const handleOpenPortal = async () => {
    setIsRedirecting(true);
    try {
      const { data, error } = await authClient.subscription.billingPortal({
        returnUrl: window.location.origin + "/home",
      });
      if (error) throw new Error(error.message);
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast.error("Não foi possível acessar o portal do Stripe agora.");
      setIsRedirecting(false);
    }
  };

  if (balanceLoading || subLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">
          Carregando informações de faturamento...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-8">
      {/* ── Plano Atual ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 gap-4">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Assinatura Atual
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-2xl font-black tracking-tight",
                planSlug === "free"
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {planName}
            </span>
            {planSlug !== "free" && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase border border-primary/20">
                Ativo
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlanModalOpen(true)}
            className="font-medium"
          >
            Alterar plano
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isRedirecting}
            onClick={handleOpenPortal}
            className="font-medium bg-primary hover:bg-primary/90"
          >
            {isRedirecting ? <Spinner /> : <CreditCard className="size-4" />}
            Gerenciar Assinatura
          </Button>
        </div>
      </div>

      <Separator className="bg-border/40" />

      {/* ── Consumo de Stars ── */}
      <div className="py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h2 className="font-semibold text-base">
              Monitoramento de Cota (Stars)
            </h2>
            <p className="text-xs text-muted-foreground">
              Seu uso acumulado de automações e IA no ciclo mensal atual.
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-bold tabular-nums">
                {used.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-muted-foreground font-medium">
                / {totalLimit.toLocaleString("pt-BR")}
              </span>
            </div>
            {extraBalance > 0 && (
              <p className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded inline-block mt-1">
                +{extraBalance.toLocaleString("pt-BR")} extras disponíveis
              </p>
            )}
          </div>
        </div>

        <StarsUsageBar used={used} limit={totalLimit} className="h-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="size-10 rounded-lg bg-background border flex items-center justify-center">
              <Star className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-bold">
                Stars Restantes
              </p>
              <p className="text-lg font-bold">
                {remaining.toLocaleString("pt-BR")} ★
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="size-10 rounded-lg bg-background border flex items-center justify-center">
              <CalendarDays className="size-5 text-[#7C3AED]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-bold">
                Próxima Renovação
              </p>
              <p className="text-lg font-bold">
                {nextCycleDate ? new Date(nextCycleDate).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long' }) : "---"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border/40" />

      {/* ── Informações ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 py-6">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Pagamento Seguro</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Utilizamos o Stripe para processar pagamentos com segurança. 
                Não armazenamos dados sensíveis de faturamento em nossos servidores.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-linear-to-br from-[#7C3AED]/10 to-transparent border border-[#7C3AED]/20">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              Precisa de ajuda com sua conta?
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Dúvidas sobre limites, estornos ou upgrade corporativo? 
              Fale diretamente com nosso time.
            </p>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#7C3AED] hover:underline bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#7C3AED]/30"
            >
              Falar com Suporte
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Histórico de Faturamento</h3>
          <button
            onClick={handleOpenPortal}
            className="w-full flex items-center justify-between p-5 rounded-2xl border border-border/80 bg-background hover:bg-muted/30 transition-all group"
          >
            <div className="text-left space-y-1">
              <h3 className="text-sm font-bold">Stripe Customer Portal</h3>
              <p className="text-xs text-muted-foreground">
                Acesse suas faturas, recibos e métodos de pagamento.
              </p>
            </div>
            <div className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <ExternalLink className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </button>
        </div>
      </div>

      <SubscriptionPlansModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        currentPlanSlug={planSlug}
      />
    </div>
  );
}
