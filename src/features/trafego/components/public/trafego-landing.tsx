"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Loader2,
  Megaphone,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePublicTrafegoPlans } from "@/features/trafego/hooks/use-trafego-plans";
import { useStartTrafegoCheckout } from "@/features/trafego/hooks/use-trafego-purchase";
import {
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVES_BY_PLATFORM,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { PriceBreakdown } from "./price-breakdown";

const STEPS = [
  { key: "platform", label: "Canal" },
  { key: "type", label: "Campanha" },
  { key: "objective", label: "Objetivo" },
  { key: "briefing", label: "Seu negócio" },
  { key: "plan", label: "Plano" },
  { key: "contact", label: "Contato" },
] as const;

const PLATFORM_CARDS: Array<{
  value: TrafegoPlatform;
  title: string;
  description: string;
  icon: typeof Megaphone;
}> = [
  {
    value: "META_ADS",
    title: "Tráfego pago no Meta",
    description:
      "Anúncios no Facebook e no Instagram para quem ainda não te conhece.",
    icon: Megaphone,
  },
  {
    value: "WHATSAPP_OFICIAL",
    title: "Disparo no WhatsApp Oficial",
    description:
      "Mensagem para a sua lista pela API oficial da Meta, sem risco de banimento.",
    icon: MessageCircle,
  },
];

const CAMPAIGN_TYPES: TrafegoCampaignType[] = [
  "PROSPECCAO",
  "REMARKETING",
  "VENDA_DIRETA",
  "RECONHECIMENTO",
  "RELACIONAMENTO",
];

export function TrafegoLanding() {
  const searchParams = useSearchParams();
  const wasCancelled = searchParams.get("cancelado") === "1";

  const [stepIndex, setStepIndex] = useState(0);
  const [platform, setPlatform] = useState<TrafegoPlatform | null>(null);
  const [campaignType, setCampaignType] = useState<TrafegoCampaignType | null>(null);
  const [objective, setObjective] = useState<TrafegoObjective | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState({
    businessName: "",
    businessNiche: "",
    targetAudience: "",
    destinationUrl: "",
    whatsappNumber: "",
    notes: "",
  });
  const [contact, setContact] = useState({ email: "", phone: "", companyName: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: plans, isLoading: isLoadingPlans } = usePublicTrafegoPlans(
    platform ?? undefined,
  );
  const startCheckout = useStartTrafegoCheckout();

  const availableObjectives = platform ? OBJECTIVES_BY_PLATFORM[platform] : [];

  const eligiblePlans = useMemo(() => {
    if (!plans || !campaignType || !objective) return [];
    return plans.filter(
      (plan) =>
        plan.campaignTypes.includes(campaignType) &&
        plan.objectives.includes(objective),
    );
  }, [plans, campaignType, objective]);

  const selectedPlan = eligiblePlans.find((plan) => plan.id === planId) ?? null;
  const step = STEPS[stepIndex];

  const canAdvance = (() => {
    switch (step.key) {
      case "platform":
        return Boolean(platform);
      case "type":
        return Boolean(campaignType);
      case "objective":
        return Boolean(objective);
      case "briefing":
        return briefing.businessName.trim().length > 1;
      case "plan":
        return Boolean(selectedPlan);
      case "contact":
        return /\S+@\S+\.\S+/.test(contact.email);
      default:
        return false;
    }
  })();

  function goNext() {
    setFormError(null);
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  }

  function goBack() {
    setFormError(null);
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function selectPlatform(value: TrafegoPlatform) {
    setPlatform(value);
    // Trocar de canal invalida objetivo e plano — os catálogos são distintos.
    setObjective(null);
    setPlanId(null);
  }

  function handleSubmit() {
    if (!platform || !campaignType || !objective || !selectedPlan) return;
    setFormError(null);

    startCheckout.mutate(
      {
        planId: selectedPlan.id,
        platform,
        campaignType,
        objective,
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone.trim() || undefined,
        companyName: contact.companyName.trim() || undefined,
        briefing: {
          businessName: briefing.businessName.trim() || undefined,
          businessNiche: briefing.businessNiche.trim() || undefined,
          targetAudience: briefing.targetAudience.trim() || undefined,
          destinationUrl: briefing.destinationUrl.trim() || undefined,
          whatsappNumber: briefing.whatsappNumber.trim() || undefined,
          notes: briefing.notes.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => window.location.assign(data.url),
        onError: (error) =>
          setFormError(
            error instanceof Error
              ? error.message
              : "Não foi possível iniciar o pagamento.",
          ),
      },
    );
  }

  return (
    <div className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <Rocket className="size-3.5" />
            trafeGO por N.A.S.A
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            Tráfego pago sem contratar agência
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
            Escolha o plano, envie seus criativos e nossa equipe coloca sua campanha
            no ar. Metade do que você paga vira verba de anúncio — e você acompanha
            tudo por um painel.
          </p>
        </header>

        {wasCancelled && (
          <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Pagamento cancelado. Seus dados continuam preenchidos — é só escolher o
            plano de novo quando quiser.
          </div>
        )}

        <Stepper currentIndex={stepIndex} />

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-8">
          {step.key === "platform" && (
            <StepShell
              title="O que você quer fazer?"
              subtitle="Dá para contratar os dois — comece por um."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {PLATFORM_CARDS.map((card) => (
                  <OptionCard
                    key={card.value}
                    selected={platform === card.value}
                    onSelect={() => selectPlatform(card.value)}
                    icon={<card.icon className="size-5" />}
                    title={card.title}
                    description={card.description}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step.key === "type" && (
            <StepShell
              title="Que tipo de campanha?"
              subtitle="Isso orienta como a equipe vai configurar a segmentação."
            >
              <div className="grid gap-2">
                {CAMPAIGN_TYPES.map((type) => (
                  <OptionRow
                    key={type}
                    selected={campaignType === type}
                    onSelect={() => {
                      setCampaignType(type);
                      setPlanId(null);
                    }}
                    label={CAMPAIGN_TYPE_LABEL[type]}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step.key === "objective" && (
            <StepShell
              title="Qual o resultado que você quer?"
              subtitle="O objetivo define como a campanha é otimizada."
            >
              <div className="grid gap-2">
                {availableObjectives.map((value) => (
                  <OptionRow
                    key={value}
                    selected={objective === value}
                    onSelect={() => {
                      setObjective(value);
                      setPlanId(null);
                    }}
                    label={OBJECTIVE_LABEL[value]}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step.key === "briefing" && (
            <StepShell
              title="Conte sobre o seu negócio"
              subtitle="Quanto mais claro, melhor a campanha que a equipe monta."
            >
              <div className="grid gap-4">
                <Field label="Nome do negócio" required>
                  <Input
                    value={briefing.businessName}
                    onChange={(event) =>
                      setBriefing({ ...briefing, businessName: event.target.value })
                    }
                    placeholder="Ex.: Padaria do Bairro"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </Field>
                <Field label="Ramo de atuação">
                  <Input
                    value={briefing.businessNiche}
                    onChange={(event) =>
                      setBriefing({ ...briefing, businessNiche: event.target.value })
                    }
                    placeholder="Ex.: Alimentação, moda, serviços"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </Field>
                <Field label="Quem você quer alcançar">
                  <Textarea
                    value={briefing.targetAudience}
                    onChange={(event) =>
                      setBriefing({ ...briefing, targetAudience: event.target.value })
                    }
                    placeholder="Ex.: mulheres de 25 a 45 anos, na zona sul, interessadas em..."
                    rows={3}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Site ou link de destino">
                    <Input
                      value={briefing.destinationUrl}
                      onChange={(event) =>
                        setBriefing({ ...briefing, destinationUrl: event.target.value })
                      }
                      placeholder="https://..."
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </Field>
                  <Field label="WhatsApp que recebe os contatos">
                    <Input
                      value={briefing.whatsappNumber}
                      onChange={(event) =>
                        setBriefing({ ...briefing, whatsappNumber: event.target.value })
                      }
                      placeholder="(11) 90000-0000"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </Field>
                </div>
                <p className="text-xs text-white/40">
                  Você pode completar ou corrigir tudo isso depois, no painel.
                </p>
              </div>
            </StepShell>
          )}

          {step.key === "plan" && (
            <StepShell
              title="Escolha o plano"
              subtitle="A verba vai direto para o anúncio. A taxa cobre criação, configuração e acompanhamento."
            >
              {isLoadingPlans && (
                <div className="flex items-center gap-2 py-8 text-sm text-white/50">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando planos…
                </div>
              )}

              {!isLoadingPlans && eligiblePlans.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/60">
                  Ainda não temos um plano para essa combinação. Volte e ajuste o tipo
                  de campanha ou o objetivo.
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {eligiblePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setPlanId(plan.id)}
                    className={cn(
                      "rounded-2xl border p-5 text-left transition",
                      planId === plan.id
                        ? "border-violet-400 bg-violet-500/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{plan.name}</p>
                        {plan.headline && (
                          <p className="mt-0.5 text-xs text-white/50">{plan.headline}</p>
                        )}
                      </div>
                      {plan.isDefault && (
                        <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                          Mais escolhido
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-2xl font-bold text-white">
                      {formatBrlFromCents(plan.totalBrlCents)}
                    </p>
                    <p className="text-xs text-white/40">
                      {plan.durationDays} dias de campanha
                    </p>

                    <PriceBreakdown
                      className="mt-4"
                      compact
                      adBudgetBrlCents={plan.adBudgetBrlCents}
                      serviceFeeBrlCents={plan.serviceFeeBrlCents}
                      totalBrlCents={plan.totalBrlCents}
                    />

                    {plan.highlights.length > 0 && (
                      <ul className="mt-4 space-y-1.5">
                        {plan.highlights.map((highlight) => (
                          <li
                            key={highlight}
                            className="flex items-start gap-2 text-xs text-white/60"
                          >
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step.key === "contact" && (
            <StepShell
              title="Para onde enviamos o acesso?"
              subtitle="Depois do pagamento você recebe um link para criar sua conta."
            >
              <div className="grid gap-4">
                <Field label="Seu melhor e-mail" required>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(event) =>
                      setContact({ ...contact, email: event.target.value })
                    }
                    placeholder="voce@empresa.com.br"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="WhatsApp para contato">
                    <Input
                      value={contact.phone}
                      onChange={(event) =>
                        setContact({ ...contact, phone: event.target.value })
                      }
                      placeholder="(11) 90000-0000"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </Field>
                  <Field label="Nome da empresa">
                    <Input
                      value={contact.companyName}
                      onChange={(event) =>
                        setContact({ ...contact, companyName: event.target.value })
                      }
                      placeholder={briefing.businessName || "Sua empresa"}
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </Field>
                </div>

                {selectedPlan && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      Resumo
                    </p>
                    <p className="mt-2 font-semibold text-white">{selectedPlan.name}</p>
                    <p className="text-xs text-white/50">
                      {PLATFORM_SHORT_LABEL[selectedPlan.platform]} ·{" "}
                      {campaignType ? CAMPAIGN_TYPE_SHORT_LABEL[campaignType] : ""} ·{" "}
                      {objective ? OBJECTIVE_LABEL[objective] : ""}
                    </p>
                    <PriceBreakdown
                      className="mt-3"
                      adBudgetBrlCents={selectedPlan.adBudgetBrlCents}
                      serviceFeeBrlCents={selectedPlan.serviceFeeBrlCents}
                      totalBrlCents={selectedPlan.totalBrlCents}
                    />
                  </div>
                )}

                {formError && (
                  <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    {formError}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-white/40">
                  <ShieldCheck className="size-4 shrink-0" />
                  Pagamento processado pelo Stripe. Não guardamos dados do cartão.
                </div>
              </div>
            </StepShell>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0 || startCheckout.isPending}
              className="text-white/60 hover:text-white"
            >
              <ArrowLeft className="mr-1.5 size-4" />
              Voltar
            </Button>

            {stepIndex < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="bg-violet-600 hover:bg-violet-500"
              >
                Continuar
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canAdvance || startCheckout.isPending}
                className="bg-violet-600 hover:bg-violet-500"
              >
                {startCheckout.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                    Abrindo pagamento…
                  </>
                ) : (
                  <>
                    Ir para o pagamento
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <ValueProps />
      </div>
    </div>
  );
}

function Stepper({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition",
                isDone && "bg-emerald-500/20 text-emerald-300",
                isCurrent && "bg-violet-500 text-white",
                !isDone && !isCurrent && "bg-white/5 text-white/40",
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs",
                isCurrent ? "font-semibold text-white" : "text-white/40",
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="hidden h-px w-6 bg-white/10 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-white/50">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border p-5 text-left transition",
        selected
          ? "border-violet-400 bg-violet-500/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20",
      )}
    >
      <span
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-xl",
          selected ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-white/50",
        )}
      >
        {icon}
      </span>
      <p className="mt-3 font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-white/50">{description}</p>
    </button>
  );
}

function OptionRow({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
        selected
          ? "border-violet-400 bg-violet-500/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-violet-400 bg-violet-500" : "border-white/20",
        )}
      >
        {selected && <Check className="size-2.5 text-white" />}
      </span>
      {label}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-white/60">
        {label}
        {required && <span className="ml-0.5 text-violet-300">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ValueProps() {
  const items = [
    {
      icon: Target,
      title: "Metade vira anúncio",
      text: "A verba do plano é investida direto na plataforma. Sem taxa escondida.",
    },
    {
      icon: BadgeCheck,
      title: "Equipe especialista",
      text: "Nosso time configura, publica e acompanha. Você não precisa aprender Meta Ads.",
    },
    {
      icon: Sparkles,
      title: "Painel próprio",
      text: "Envie criativos, acompanhe o desempenho e fale com o suporte num lugar só.",
    },
  ];

  return (
    <div className="mt-10 grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <item.icon className="size-5 text-violet-300" />
          <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">{item.text}</p>
        </div>
      ))}
    </div>
  );
}
