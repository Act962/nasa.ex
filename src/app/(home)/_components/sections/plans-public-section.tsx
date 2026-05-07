"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PlanDetailModal,
  type PlanDetail,
} from "@/components/plan-detail-modal";
import { PlanPurchaseModal } from "@/features/stars/components/plan-purchase-modal";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

// Custo de Star por usuário ativo/mês (regra global)
const STAR_PER_USER = 30;

// CTA configurado como link externo (ex: "Falar com consultor") — pula checkout.
function isExternalCta(href?: string | null): href is string {
  if (!href) return false;
  return /^(https?:|mailto:|tel:)/i.test(href);
}

const PUBLIC_PLANS = [
  {
    id: "suit",
    name: "Suit",
    slogan: "Para quem está dando os primeiros passos",
    price: 0,
    billingLabel: "/mês",
    stars: 0,
    rollover: 0,
    highlighted: false,
    ctaLabel: "Começar grátis",
    ctaHref: "/sign-up",
    badge: null,
    benefits: [
      "CRM completo e pipeline de vendas",
      "Usuários ilimitados — 30★ por usuário/mês",
      "Agenda e agendamentos",
      "Proposta e contratos (FORGE)",
      "N.Box — gerenciamento de arquivos",
      "Compre Stars avulsas para crescer",
      "Suporte por e-mail",
    ],
  },
  {
    id: "earth",
    name: "Earth",
    slogan: "Primeiros resultados com automação",
    price: 197,
    billingLabel: "/mês",
    stars: 1000,
    rollover: 20,
    highlighted: false,
    ctaLabel: "Assinar Earth",
    ctaHref: "/sign-up",
    badge: null,
    benefits: [
      "Tudo do Suit, mais:",
      "1.000 Stars mensais",
      "20% de rollover de Stars",
      "Suporta ~26 usuários ativos/mês",
      "Relatórios básicos",
      "Suporte prioritário",
    ],
  },
  {
    id: "explore",
    name: "Explore",
    slogan: "Para empresas que automatizam e crescem",
    price: 397,
    billingLabel: "/mês",
    stars: 3000,
    rollover: 25,
    highlighted: true,
    ctaLabel: "Assinar Explore",
    ctaHref: "/sign-up",
    badge: "MAIS POPULAR",
    benefits: [
      "Tudo do Earth, mais:",
      "3.000 Stars mensais",
      "25% de rollover de Stars",
      "Suporta ~80 usuários ativos/mês",
      "IA ASTRO completo",
      "NASA Planner + Mind Maps",
      "Space Points gamificado",
      "Suporte dedicado",
    ],
  },
  {
    id: "constellation",
    name: "Constellation",
    slogan: "Para empresas sem limites",
    price: 797,
    billingLabel: "/mês",
    stars: 20000,
    rollover: 30,
    highlighted: false,
    ctaLabel: "Falar com vendas",
    ctaHref: "mailto:vendas@nasaex.com.br",
    badge: "ENTERPRISE",
    benefits: [
      "Tudo do Explore, mais:",
      "20.000 Stars mensais",
      "30% de rollover de Stars",
      "Suporta ~500+ usuários ativos/mês",
      "Gerente de conta dedicado",
      "SLA customizado",
      "Onboarding personalizado",
      "Relatórios avançados",
    ],
  },
];

function PublicPlanCard({
  plan,
  isLoggedIn,
  currentPlanSlug,
  onPurchase,
}: {
  plan: (typeof PUBLIC_PLANS)[number] & { planSlug?: string };
  isLoggedIn: boolean;
  currentPlanSlug?: string;
  onPurchase?: (planSlug: string) => void;
}) {
  const [showBenefits, setShowBenefits] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const slug = plan.planSlug ?? plan.id;
  const externalHref = isExternalCta(plan.ctaHref) ? plan.ctaHref : null;
  // Plano com link externo (ex: "Falar com consultor") nunca é "plano atual".
  const isCurrentPlan =
    !externalHref && isLoggedIn && currentPlanSlug === slug;

  const handleCtaClick = () => {
    if (externalHref) {
      const isHttp = /^https?:/i.test(externalHref);
      if (isHttp) {
        window.open(externalHref, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = externalHref;
      }
      return;
    }
    onPurchase?.(slug);
  };

  const planDetail: PlanDetail = {
    id: plan.id,
    name: plan.name,
    slogan: plan.slogan,
    price: plan.price,
    stars: plan.stars,
    rollover: plan.rollover,
    highlighted: plan.highlighted,
    badge: plan.badge,
    benefits: plan.benefits,
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaHref,
    starPerUser: STAR_PER_USER,
    planSlug: slug,
  };

  return (
    <>
      <PlanDetailModal
        plan={planDetail}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        isLoggedIn={isLoggedIn}
        isCurrentPlan={isCurrentPlan}
        onPurchase={handleCtaClick}
      />

      <div
        className={cn(
          "relative flex flex-col rounded-xl border p-5 space-y-4 transition-all card-hover",
          plan.highlighted
            ? "border-violet-500/50 bg-violet-950/20 shadow-[0_0_40px_rgba(124,58,237,.15)]"
            : plan.id === "constellation"
              ? "border-yellow-500/30 bg-yellow-950/10"
              : plan.price === 0
                ? "border-emerald-700/30 bg-emerald-950/10"
                : "border-zinc-700/50 bg-zinc-900/80",
        )}
      >
        {/* Badges */}
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span
              className={cn(
                "text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap",
                plan.highlighted
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/40"
                  : "bg-linear-to-r from-yellow-500 to-orange-500 text-black",
              )}
            >
              {plan.badge}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="font-bold text-white text-lg hover:text-violet-300 transition-colors cursor-pointer underline-offset-2 hover:underline"
              >
                {plan.name}
              </button>
              {plan.highlighted && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600/30 text-violet-300 border border-violet-700/50">
                  ⭐ Destaque
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5">{plan.slogan}</p>
          </div>
          <div className="text-right shrink-0">
            {plan.price === 0 ? (
              <p className="text-xl font-bold text-emerald-400">Grátis</p>
            ) : (
              <p className="text-xl font-bold text-white">
                R$ {plan.price.toLocaleString("pt-BR")}
              </p>
            )}
            <p className="text-[10px] text-white/30">por mês</p>
          </div>
        </div>

        {/* Stats — igual ao admin PlanCard */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5">
            <Star className="w-3.5 h-3.5 text-yellow-400 mb-0.5" />
            <span className="font-semibold text-white">
              {plan.stars === 0
                ? "—"
                : plan.stars >= 1000
                  ? `${plan.stars / 1000}K`
                  : plan.stars}
            </span>
            <span className="text-white/30 text-[9px]">Stars/mês</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-violet-500/8 border border-violet-500/20">
            <Users className="w-3.5 h-3.5 text-violet-400 mb-0.5" />
            <span className="font-semibold text-violet-300">
              {STAR_PER_USER}★
            </span>
            <span className="text-violet-400/50 text-[9px]">por usuário</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-base mb-0.5">🔁</span>
            <span className="font-semibold text-white">{plan.rollover}%</span>
            <span className="text-white/30 text-[9px]">Rollover</span>
          </div>
        </div>

        {/* Usuários ilimitados pill */}
        <div className="flex items-center gap-1.5 bg-violet-500/8 border border-violet-500/15 rounded-lg px-3 py-2">
          <Users className="size-3 text-violet-400 shrink-0" />
          <span className="text-violet-300/80 text-[11px] font-medium">
            Usuários ilimitados — {STAR_PER_USER}★ por usuário/mês
          </span>
        </div>

        {/* Benefits colapsável — igual ao admin */}
        <div>
          <button
            type="button"
            onClick={() => setShowBenefits(!showBenefits)}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            {showBenefits ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {plan.benefits.length} benefício(s) incluídos
          </button>
          {showBenefits && (
            <ul className="mt-2 space-y-1.5">
              {plan.benefits.map((b, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-1.5 text-xs",
                    b.startsWith("Tudo do")
                      ? "text-white/30 font-semibold"
                      : "text-white/55",
                  )}
                >
                  {b.startsWith("Tudo do") ? (
                    <ChevronUp className="w-3 h-3 shrink-0 mt-0.5 text-white/20" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Divisor */}
        <div className="border-t border-white/8" />

        {/* CTA */}
        {isCurrentPlan ? (
          <Button
            disabled
            className={cn(
              "w-full font-bold text-sm rounded-xl opacity-60 cursor-not-allowed",
              plan.price === 0
                ? "bg-emerald-700 text-white"
                : plan.highlighted
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-700/80 text-white border border-zinc-600/50",
            )}
          >
            Plano atual
          </Button>
        ) : isLoggedIn ? (
          <Button
            onClick={handleCtaClick}
            className={cn(
              "w-full font-bold text-sm rounded-xl",
              plan.highlighted
                ? "bg-violet-600 hover:bg-violet-700 text-white"
                : plan.id === "constellation"
                  ? "bg-linear-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500 hover:to-orange-500 text-black"
                  : plan.price === 0
                    ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                    : "bg-zinc-700/80 hover:bg-zinc-700 text-white border border-zinc-600/50",
            )}
          >
            {externalHref ? plan.ctaLabel : "Adquirir plano"}
            <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={handleCtaClick}
            className={cn(
              "w-full font-bold text-sm rounded-xl",
              plan.highlighted
                ? "bg-violet-600 hover:bg-violet-700 text-white"
                : plan.id === "constellation"
                  ? "bg-linear-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500 hover:to-orange-500 text-black"
                  : plan.price === 0
                    ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                    : "bg-zinc-700/80 hover:bg-zinc-700 text-white border border-zinc-600/50",
            )}
          >
            {plan.ctaLabel}
            <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    </>
  );
}

export function PlansPublicSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchasePlanSlug, setPurchasePlanSlug] = useState<string | undefined>(
    undefined,
  );
  void setPurchasePlanSlug;

  // Fetch plans live from DB (public endpoint, no auth needed)
  const { data: dbData, isLoading: plansLoading } = useQuery(
    orpc.public.listPlans.queryOptions(),
  );

  // Fetch current plan slug for logged-in users
  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    enabled: isLoggedIn,
  });
  const currentPlanSlug = balanceData?.planSlug;
  const router = useRouter();

  const handlePurchase = (planSlug: string) => {
    const confirmationUrl = `/subscription/confirm?plan=${planSlug}`;

    if (!isLoggedIn) {
      // Redirect to sign-in with intent
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(confirmationUrl)}`,
      );
    } else {
      // Go directly to confirmation page
      router.push(confirmationUrl);
    }
  };

  // Map DB plans → PublicPlanCard shape, fall back to hardcoded
  const plans =
    (dbData?.plans ?? []).length > 0
      ? dbData!.plans.map((p) => ({
          id: p.slug,
          planSlug: p.slug,
          name: p.name,
          stars: p.monthlyStars,
          price: p.priceMonthly,
          billingLabel: "/mês",
          rollover: p.rolloverPct,
          highlighted: p.highlighted,
          badge: p.highlighted ? ("MAIS POPULAR" as string | null) : null,
          slogan: p.slogan ?? "",
          benefits: p.benefits,
          ctaLabel: p.ctaLabel,
          ctaHref: p.ctaLink ?? "/sign-up",
        }))
      : PUBLIC_PLANS;

  return (
    <section id="planos" className="py-28 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-200 h-100 bg-[#7C3AED]/5 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-5 py-2">
            <Sparkles className="size-3.5 text-violet-400" />
            <span className="text-violet-300 text-sm font-semibold tracking-wide">
              Planos NASA
            </span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-3 leading-tight">
          Escolha seu <span className="text-nasa">ponto de partida</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-6 max-w-xl mx-auto">
          De startups a operações enterprise — escale flexível com o Método
          N.A.S.A.®
        </p>

        {/* Regra de Stars por usuário — destaque */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-linear-to-r from-violet-950/40 to-blue-950/30 border border-violet-500/25 rounded-2xl px-6 py-5">
            <div className="text-4xl shrink-0">🚀</div>
            <div className="text-center sm:text-left">
              <p className="text-white font-black text-lg leading-tight">
                Empresas e usuários são{" "}
                <span className="text-violet-300">ilimitados</span>
              </p>
              <p className="text-white/50 text-sm mt-1">
                Não existe limite de usuários em nenhum plano. Cada usuário
                ativo custa{" "}
                <span className="text-yellow-400 font-bold">
                  {STAR_PER_USER} ★/mês
                </span>
                . Basta ter crédito Star e{" "}
                <span className="text-violet-300 font-semibold">Decole!</span>
              </p>
            </div>
            <div className="shrink-0 text-center bg-violet-600/20 border border-violet-500/30 rounded-xl px-4 py-3">
              <p className="text-violet-300 font-black text-2xl">
                {STAR_PER_USER}★
              </p>
              <p className="text-white/30 text-[10px]">por usuário/mês</p>
            </div>
          </div>
        </div>

        {plansLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-72 rounded-xl bg-white/4 animate-pulse border border-white/6"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <PublicPlanCard
                key={plan.id}
                plan={plan}
                isLoggedIn={isLoggedIn}
                currentPlanSlug={currentPlanSlug}
                onPurchase={handlePurchase}
              />
            ))}
          </div>
        )}

        <p className="text-center text-white/15 text-xs mt-8">
          🔒 Pagamento seguro via Stripe e PIX (Asaas) · Cancele quando quiser ·
          LGPD Compliant
        </p>
      </div>

      {/* Modal de compra de plano */}
      <PlanPurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        currentPlanSlug={currentPlanSlug}
        initialPlanSlug={purchasePlanSlug}
      />
    </section>
  );
}
