"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Integration } from "@/types/integration";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ExternalLink, Zap, Bot, Wrench, ArrowRight,
  ChevronLeft, CreditCard, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types/integration";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import { CredentialForm } from "./credential-form";
import { orpc } from "@/lib/orpc";
import { StarIcon } from "@/features/stars/components/star-icon";

interface InstallModalProps {
  integration: Integration;
  open: boolean;
  onClose: () => void;
}

// choose → payment → (manual | astro_confirm) → manual_creds → done
type InstallMode =
  | "choose"
  | "payment"        // escolha: créditos vs cartão
  | "manual"
  | "manual_creds";

type InstallMethod = "ai" | "manual";

// ─── Logo ─────────────────────────────────────────────────────────────────────

function IntegrationLogo({ integration }: { integration: Integration }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackEmoji = CATEGORY_ICONS[integration.category] ?? "🔌";
  const isUrl = integration.icon.startsWith("http");

  if (!isUrl) {
    return (
      <div className="size-12 rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#a855f7]/10 border border-[#7C3AED]/20 flex items-center justify-center shrink-0 text-2xl">
        {integration.icon}
      </div>
    );
  }

  return (
    <div className="size-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 relative border border-border/50">
      <div className={cn(
        "absolute inset-0 rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#a855f7]/10 flex items-center justify-center text-xl",
        imgLoaded && !imgFailed && "opacity-0",
      )}>
        {fallbackEmoji}
      </div>
      {!imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={integration.icon}
          alt={integration.name}
          className={cn("absolute inset-0 size-full object-contain bg-white p-1.5 transition-opacity duration-200", imgLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}

// ─── Step indicators (manual flow) ───────────────────────────────────────────

function ManualSteps({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Habilitar" },
    { n: 2, label: "Credenciais" },
    { n: 3, label: "Pronto!" },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done = s.n < step;
        const active = s.n === step;
        return (
          <div key={s.n} className="flex items-center">
            <div className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium",
              active ? "text-[#7C3AED]" : done ? "text-emerald-600" : "text-muted-foreground",
            )}>
              <div className={cn(
                "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                active ? "bg-[#7C3AED] text-white" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
              )}>
                {done ? <CheckCircle2 className="size-3" /> : s.n}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground/40 mx-1.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Payment choice step ──────────────────────────────────────────────────────

function PaymentChoice({
  integration,
  method,
  onCredits,
  onCard,
  onBack,
}: {
  integration: Integration;
  method: InstallMethod;
  onCredits: () => void;
  onCard: () => void;
  onBack: () => void;
}) {
  const [cardLoading, setCardLoading] = useState(false);

  const { data: costData } = useQuery({
    ...orpc.stars.getAppCost.queryOptions({ input: { appSlug: integration.slug } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
  });

  const monthlyCost  = costData?.monthlyCost ?? 0;
  const setupCost    = costData?.setupCost ?? 0;
  const totalCost    = setupCost + monthlyCost;
  const priceBrl     = costData?.priceBrl ?? null;
  const balance      = balanceData?.balance ?? 0;
  const hasEnough    = balance >= totalCost;
  const hasPlan      = balanceData && balanceData.planSlug !== "free";

  const handleCard = async () => {
    if (!priceBrl) { onCard(); return; }
    setCardLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId:  getAppPriceId(integration.slug),
          mode:     "payment",
          itemType: "topup",
          itemSlug: integration.slug,
          cancelPath: `/integrations/${integration.slug}`,
        }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        // Stripe não configurado — prosseguir sem pagamento (dev)
        onCard();
      }
    } catch {
      onCard();
    } finally {
      setCardLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-1">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Como deseja pagar?</p>
        <p className="text-[11px] text-muted-foreground">
          {method === "ai" ? "Instalação via ASTRO · " : "Instalação manual · "}
          {integration.name}
        </p>
      </div>

      <div className="space-y-3">
        {/* ── Créditos (Stars) ── */}
        <button
          onClick={onCredits}
          disabled={!hasEnough || !hasPlan || totalCost === 0}
          className={cn(
            "w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left",
            !hasEnough || !hasPlan || totalCost === 0
              ? "border-border/40 bg-muted/20 opacity-60 cursor-not-allowed"
              : "border-yellow-300 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:border-yellow-700 dark:hover:bg-yellow-950/30"
          )}
        >
          <div className="size-9 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center shrink-0">
            <StarIcon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Descontar com créditos</p>
            {totalCost > 0 ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {setupCost > 0 && <span>Ativação: {setupCost} ★  ·  </span>}
                Mensal: {monthlyCost} ★  ·  Saldo: {balance.toLocaleString("pt-BR")} ★
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Integração gratuita em Stars
              </p>
            )}
            {!hasPlan && (
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                ⚠ Você precisa ter um plano ativo para usar créditos
              </p>
            )}
            {hasPlan && !hasEnough && totalCost > 0 && (
              <p className="text-[11px] text-red-500 font-medium mt-0.5">
                Saldo insuficiente — precisaria de {totalCost} ★
              </p>
            )}
          </div>
          {hasEnough && hasPlan && (
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
          )}
        </button>

        {/* ── Cartão (Stripe) ── */}
        <button
          onClick={handleCard}
          disabled={cardLoading}
          className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-[#7C3AED]/30 bg-[#7C3AED]/5 hover:border-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all text-left"
        >
          <div className="size-9 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
            {cardLoading ? (
              <Loader2 className="size-4 text-[#7C3AED] animate-spin" />
            ) : (
              <CreditCard className="size-4 text-[#7C3AED]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Pagar com cartão</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {priceBrl
                ? `R$ ${priceBrl}/mês · Renovação automática via Stripe`
                : "Checkout seguro via Stripe"}
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        </button>
      </div>

      <Button variant="ghost" size="sm" onClick={onBack} className="w-full text-muted-foreground">
        <ChevronLeft className="size-3.5" /> Voltar
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InstallModal({ integration, open, onClose }: InstallModalProps) {
  const { install, triggerAstroInstall } = useMarketplace();
  const [mode, setMode]           = useState<InstallMode>("choose");
  const [method, setMethod]       = useState<InstallMethod>("manual");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);
  const [manualStep, setManualStep] = useState<1 | 2 | 3>(1);

  const hasCredentials = (integration.credentials ?? []).length > 0;

  const resetState = () => {
    setMode("choose");
    setMethod("manual");
    setDone(false);
    setLoading(false);
    setCredsSaved(false);
    setManualStep(1);
  };

  // After payment choice: proceed with install
  const proceedInstall = async (chosenMethod: InstallMethod) => {
    if (chosenMethod === "ai") {
      onClose();
      resetState();
      triggerAstroInstall(integration);
      return;
    }

    // manual
    setMode("manual");
    setManualStep(1);
  };

  const handleManualInstall = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    install(integration.slug);
    setLoading(false);
    if (hasCredentials) {
      setMode("manual_creds");
      setManualStep(2);
    } else {
      setDone(true);
      setManualStep(3);
      setTimeout(() => { onClose(); resetState(); }, 1800);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetState(); } }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <IntegrationLogo integration={integration} />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">{integration.name}</DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">
                  {CATEGORY_LABELS[integration.category]}
                </Badge>
                {integration.tags.filter((t) => !["Instalado", "Visualizar"].includes(t)).slice(0, 2).map((t) => (
                  <span key={t} className="text-[10px] text-muted-foreground">· {t}</span>
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ── STEP 1: Como instalar? ── */}
        {mode === "choose" && (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground leading-relaxed">{integration.description}</p>

            {hasCredentials && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <Zap className="size-3.5 text-[#7C3AED] shrink-0" />
                Processo simples em 2 etapas: habilitar + inserir credenciais
              </div>
            )}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Como deseja instalar?
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* IA */}
              <button
                onClick={() => { setMethod("ai"); setMode("payment"); }}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-[#7C3AED]/30 bg-[#7C3AED]/5 hover:border-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all"
              >
                <div className="size-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Bot className="size-5 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Instalar com IA</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">ASTRO guia você</p>
                </div>
                <Badge className="bg-[#7C3AED] text-white text-[10px]">Recomendado</Badge>
              </button>

              {/* Manual */}
              <button
                onClick={() => { setMethod("manual"); setMode("payment"); }}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-foreground/30 hover:bg-muted/40 transition-all"
              >
                <div className="size-10 rounded-full bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wrench className="size-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Manual</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Configuro por conta própria</p>
                </div>
              </button>
            </div>

            {integration.connectUrl && (
              <a href={integration.connectUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#7C3AED] hover:underline">
                <ExternalLink className="size-3.5" /> Ver documentação oficial
              </a>
            )}
          </div>
        )}

        {/* ── STEP 2: Pagamento ── */}
        {mode === "payment" && (
          <PaymentChoice
            integration={integration}
            method={method}
            onCredits={() => proceedInstall(method)}
            onCard={() => proceedInstall(method)}
            onBack={() => setMode("choose")}
          />
        )}

        {/* ── STEP 3 (manual): Habilitar ── */}
        {mode === "manual" && !done && (
          <div className="space-y-4 py-1">
            <ManualSteps step={manualStep} />

            <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                <span className="size-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                Habilitar {integration.name} no NASA
              </p>
              <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
                Clique em <strong>Confirmar</strong> para habilitar esta integração no seu painel. No próximo passo você inserirá as credenciais da sua conta.
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 dark:bg-amber-950/20 dark:border-amber-900/50 flex items-start gap-2">
              <Zap className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                O NASA fornece o caminho. As credenciais (Token, API Key) pertencem à <strong>sua conta</strong> na plataforma.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-0">
              <Button variant="outline" size="sm" onClick={() => setMode("payment")} disabled={loading}>
                <ChevronLeft className="size-3.5" /> Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleManualInstall}
                disabled={loading}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
              >
                {loading ? (
                  <><Loader2 className="size-3.5 animate-spin" /> Habilitando...</>
                ) : (
                  <><Zap className="size-3.5" /> Confirmar</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STEP 4 (manual): Credenciais ── */}
        {mode === "manual_creds" && (
          <div className="space-y-4 py-1">
            <ManualSteps step={2} />

            <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-3 dark:bg-emerald-950/20 dark:border-emerald-900/50 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                {integration.name} habilitado! Agora insira suas credenciais.
              </p>
            </div>

            {hasCredentials && (
              <CredentialForm
                slug={integration.slug}
                fields={integration.credentials!}
                onSaved={() => setCredsSaved(true)}
                compact
              />
            )}

            <DialogFooter className="gap-2 pt-0">
              <Button
                variant={credsSaved ? "default" : "outline"}
                size="sm"
                onClick={() => { onClose(); resetState(); }}
                className={cn(credsSaved && "bg-emerald-600 hover:bg-emerald-700 text-white gap-2")}
              >
                {credsSaved ? (
                  <><CheckCircle2 className="size-3.5" /> Concluir configuração</>
                ) : (
                  "Configurar depois"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── DONE ── */}
        {done && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-emerald-700">{integration.name} habilitado!</p>
              <p className="text-sm text-muted-foreground">
                Integração ativa no seu painel NASA.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper: resolve app price ID (futura integração Stripe por app)
function getAppPriceId(appSlug: string): string {
  const map: Record<string, string> = {
    "whatsapp-business":  process.env.NEXT_PUBLIC_STRIPE_PRICE_WHATSAPP  ?? "price_wpp_placeholder",
    "instagram-dm":       process.env.NEXT_PUBLIC_STRIPE_PRICE_INSTAGRAM ?? "price_ig_placeholder",
    "tiktok":             process.env.NEXT_PUBLIC_STRIPE_PRICE_TIKTOK    ?? "price_tiktok_placeholder",
    "linkedin":           process.env.NEXT_PUBLIC_STRIPE_PRICE_LINKEDIN  ?? "price_linkedin_placeholder",
  };
  return map[appSlug] ?? "price_app_placeholder";
}
