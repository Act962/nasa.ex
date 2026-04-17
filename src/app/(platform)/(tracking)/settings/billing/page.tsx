"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import {
  CreditCard,
  Zap,
  Star,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { SubscriptionPlansModal } from "@/features/stars/components/subscription-plans-modal";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

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

  const planMonthlyStars = activeSub?.limits?.monthlyStars
    ? Number(activeSub.limits.monthlyStars)
    : (balanceData?.planMonthlyStars ?? 0);

  const balance = balanceData?.balance ?? 0;
  const consumed = activeSub || planSlug !== "free" ? balance : 0;
  const remaining = Math.max(0, planMonthlyStars - consumed);
  const pctUsed =
    planMonthlyStars > 0 ? (consumed / planMonthlyStars) * 100 : 0;

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
      <div className="flex items-center justify-between py-6">
        <div className="space-y-1">
          <h2 className="font-medium">Assinatura Atual</h2>
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

      <Separator />

      {/* ── Consumo de Stars ── */}
      <div className="py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium leading-relaxed">
              Consumo de Créditos (Stars)
            </h2>
            <p className="text-xs text-muted-foreground">
              Créditos inclusos no seu plano mensal para operações e IA.
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold">
              {consumed.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">
              {" "}
              / {planMonthlyStars.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              pctUsed >= 90 ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${Math.max(1, Math.min(100, pctUsed))}%` }}
          />
        </div>

        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-muted-foreground font-medium">
            {Math.round(pctUsed)}% utilizado
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {remaining.toLocaleString()} Stars restantes
          </span>
        </div>
      </div>

      <Separator />

      {/* ── Detalhes Adicionais ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 py-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Star className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Uso de automação</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                As Stars são consumidas conforme você utiliza ferramentas de IA
                e automações no app.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <ShieldCheck className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Faturamento Seguro</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Seus pagamentos são processados com segurança via Stripe. Não
                armazenamos seus dados de cartão.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
              Precisa de ajuda?
            </h3>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Dúvidas sobre cobrança ou migração de plano? Fale com nosso
              suporte.
            </p>
            <Link
              href="/support"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 group"
            >
              Contatar Suporte
              <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <button
            onClick={handleOpenPortal}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors group"
          >
            <div className="text-left">
              <h3 className="text-sm font-medium">Ver faturas anteriores</h3>
              <p className="text-[10px] text-muted-foreground">
                Acesse recibos e histórico no Stripe
              </p>
            </div>
            <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
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
