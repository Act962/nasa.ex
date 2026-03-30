"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StarIcon } from "./star-icon";
import {
  Check, Loader2, CreditCard, Rocket, Users, ArrowRight, Sparkles,
} from "lucide-react";

interface PlanSelectModalProps {
  open: boolean;
  onClose: () => void;
}

const PLAN_FEATURES: Record<string, string[]> = {
  earth: [
    "500 ★ Stars por mês",
    "Até 3 usuários",
    "Chat IA (ASTRO)",
    "Integrações básicas",
    "Suporte por e-mail",
  ],
  explore: [
    "2.000 ★ Stars por mês",
    "Até 10 usuários",
    "Chat IA (ASTRO) avançado",
    "Todas as integrações",
    "Suporte prioritário",
    "Relatórios avançados",
  ],
  constellation: [
    "Stars ilimitados",
    "Usuários ilimitados",
    "Gerente de conta dedicado",
    "SLA customizado",
    "Integrações exclusivas",
    "Onboarding personalizado",
  ],
};

const PLAN_ICONS: Record<string, string> = {
  earth: "🌍",
  explore: "🚀",
  constellation: "✨",
};

const PLAN_HIGHLIGHT: Record<string, boolean> = {
  explore: true,
};

export function PlanSelectModal({ open, onClose }: PlanSelectModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    ...orpc.stars.listPlans.queryOptions(),
    enabled: open,
  });

  const plans = data?.plans ?? [];

  const handleChoose = async (planSlug: string) => {
    if (planSlug === "constellation") {
      // Constellation = fale com vendas
      window.open("mailto:vendas@nasaex.com.br?subject=Plano Constellation", "_blank");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId:  getPriceId(planSlug),
          mode:     "subscription",
          itemType: "plan",
          itemSlug: planSlug,
        }),
      });

      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        // Fallback: se Stripe não estiver configurado, simula seleção
        console.warn("[PlanSelectModal] Stripe não configurado:", json.error);
        alert("Gateway de pagamento não configurado neste ambiente. Configure STRIPE_SECRET_KEY.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">Escolha seu plano</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Stars são creditados mensalmente e usados para manter integrações ativas
              </p>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
            {plans.map((plan) => {
              const isHighlight = PLAN_HIGHLIGHT[plan.slug];
              const isConstellation = plan.slug === "constellation";
              const features = PLAN_FEATURES[plan.slug] ?? [];

              return (
                <div
                  key={plan.slug}
                  className={cn(
                    "relative flex flex-col rounded-xl border-2 p-4 transition-all cursor-pointer",
                    isHighlight
                      ? "border-[#7C3AED] bg-[#7C3AED]/5 shadow-[0_0_20px_rgba(124,58,237,0.15)]"
                      : "border-border hover:border-[#7C3AED]/40 hover:bg-muted/30",
                    selected === plan.slug && "ring-2 ring-[#7C3AED] ring-offset-2"
                  )}
                  onClick={() => setSelected(plan.slug)}
                >
                  {isHighlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#7C3AED] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        Mais popular
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-1.5">{PLAN_ICONS[plan.slug]}</div>
                    <p className="font-bold text-lg">{plan.name}</p>

                    {isConstellation ? (
                      <p className="text-sm text-muted-foreground mt-1">Sob consulta</p>
                    ) : (
                      <div className="mt-1">
                        <span className="text-2xl font-extrabold">
                          R$ {plan.priceMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </span>
                        <span className="text-xs text-muted-foreground">/mês</span>
                      </div>
                    )}

                    {!isConstellation && (
                      <div className="flex items-center justify-center gap-1 mt-2 text-[11px] font-semibold text-[#7C3AED]">
                        <StarIcon className="size-3.5" />
                        {plan.monthlyStars.toLocaleString("pt-BR")} stars/mês
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-1 mt-1 text-[11px] text-muted-foreground">
                      <Users className="size-3" />
                      {plan.maxUsers >= 999 ? "Ilimitado" : `Até ${plan.maxUsers} usuários`}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[11px]">
                        <Check className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    size="sm"
                    disabled={loading}
                    className={cn(
                      "w-full mt-4 gap-1.5 font-semibold text-xs",
                      isHighlight
                        ? "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                        : isConstellation
                        ? "bg-gradient-to-r from-[#7C3AED] to-[#a855f7] text-white"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChoose(plan.slug);
                    }}
                  >
                    {loading && selected === plan.slug ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Redirecionando...</>
                    ) : isConstellation ? (
                      <><Sparkles className="size-3.5" /> Falar com vendas</>
                    ) : (
                      <><CreditCard className="size-3.5" /> Assinar agora <ArrowRight className="size-3" /></>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Security note */}
        <p className="text-center text-[11px] text-muted-foreground pb-1">
          🔒 Pagamento seguro via <strong>Stripe</strong> — cancele quando quiser, sem multas
        </p>
      </DialogContent>
    </Dialog>
  );
}

// Helper local — resolve price ID sem chamar o servidor
function getPriceId(planSlug: string): string {
  const map: Record<string, string> = {
    earth:        process.env.NEXT_PUBLIC_STRIPE_PRICE_EARTH    ?? "price_earth_placeholder",
    explore:      process.env.NEXT_PUBLIC_STRIPE_PRICE_EXPLORE  ?? "price_explore_placeholder",
  };
  return map[planSlug] ?? "price_placeholder";
}
