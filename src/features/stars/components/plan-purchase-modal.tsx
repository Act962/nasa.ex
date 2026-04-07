"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Loader2, Sparkles, Zap, ChevronLeft,
  ExternalLink, Copy, Check, QrCode, CreditCard, FileText, Users,
} from "lucide-react";
import { StarIcon } from "./star-icon";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "plans" | "method" | "processing" | "pix" | "success";
type PaymentMethod = "pix" | "credit_card" | "boleto";

export interface PlanPurchaseModalProps {
  open:             boolean;
  onClose:          () => void;
  currentPlanSlug?: string;
  initialPlanSlug?: string; // pre-selects and skips to payment method
}

// ── Payment method display config ─────────────────────────────────────────────

const METHOD_META: Record<PaymentMethod, {
  icon:         React.ElementType;
  color:        string;
  bg:           string;
  border:       string;
  activeBorder: string;
  activeBg:     string;
  badge?:       string;
}> = {
  pix: {
    icon:         QrCode,
    color:        "text-emerald-600 dark:text-emerald-400",
    bg:           "bg-emerald-50 dark:bg-emerald-900/30",
    border:       "border-emerald-200 dark:border-emerald-800/50",
    activeBorder: "border-emerald-500",
    activeBg:     "bg-emerald-50/80 dark:bg-emerald-900/20",
    badge:        "Instantâneo",
  },
  credit_card: {
    icon:         CreditCard,
    color:        "text-violet-600 dark:text-violet-400",
    bg:           "bg-violet-50 dark:bg-violet-900/30",
    border:       "border-violet-200 dark:border-violet-800/50",
    activeBorder: "border-violet-500",
    activeBg:     "bg-violet-50/80 dark:bg-violet-900/20",
  },
  boleto: {
    icon:         FileText,
    color:        "text-amber-600 dark:text-amber-400",
    bg:           "bg-amber-50 dark:bg-amber-900/30",
    border:       "border-amber-200 dark:border-amber-800/50",
    activeBorder: "border-amber-500",
    activeBg:     "bg-amber-50/80 dark:bg-amber-900/20",
    badge:        "3 dias úteis",
  },
};

const BILLING_LABEL: Record<string, string> = {
  monthly: "/mês",
  annual:  "/ano",
  weekly:  "/sem",
};

// ── Modal ─────────────────────────────────────────────────────────────────────

export function PlanPurchaseModal({
  open,
  onClose,
  currentPlanSlug,
  initialPlanSlug,
}: PlanPurchaseModalProps) {
  const [step,           setStep]           = useState<Step>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [copied,         setCopied]         = useState(false);
  const [pixQrCode,      setPixQrCode]      = useState<string | null>(null);
  const [pixPayload,     setPixPayload]     = useState<string | null>(null);
  const [checkoutUrl,    setCheckoutUrl]    = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: plansData, isLoading: plansLoading } = useQuery({
    ...orpc.stars.listPlans.queryOptions(),
    enabled: open,
  });

  const { data: methodsData, isLoading: methodsLoading } = useQuery({
    ...orpc.stars.listActiveGateways.queryOptions(),
    enabled: open,
  });

  const plans   = plansData?.plans   ?? [];
  const methods = methodsData?.methods ?? [];

  // ── Auto-advance when initialPlanSlug is provided ────────────────────────────
  useEffect(() => {
    if (!open || !initialPlanSlug || plans.length === 0) return;
    const found = plans.find((p) => p.slug === initialPlanSlug);
    if (found) {
      setSelectedPlanId(found.id);
      setStep("method");
    }
  }, [open, initialPlanSlug, plans]);

  // ── Reset on close ────────────────────────────────────────────────────────────
  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("plans");
      setSelectedPlanId(null);
      setSelectedMethod(null);
      setPixQrCode(null);
      setPixPayload(null);
      setCheckoutUrl(null);
    }, 300);
  };

  // ── Checkout mutation ─────────────────────────────────────────────────────────
  const { mutate: checkout } = useMutation({
    ...orpc.plans.createPlanCheckout.mutationOptions(),
    onSuccess: (result) => {
      if (result.pixQrCode) {
        setPixQrCode(result.pixQrCode);
        setPixPayload(result.pixPayload ?? null);
        setCheckoutUrl(result.checkoutUrl ?? null);
        setStep("pix");
      } else if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Erro ao iniciar pagamento.");
      setStep("method");
    },
  });

  const handleMethodSelect = (method: PaymentMethod) => {
    if (!selectedPlanId) return;
    setSelectedMethod(method);
    setStep("processing");
    checkout({ planId: selectedPlanId, paymentMethod: method });
  };

  const goBack = () => {
    if (step === "method") setStep("plans");
    if (step === "pix")    setStep("method");
  };

  const copyPixCode = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a14] border-white/10">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2">
            {(step === "method" || step === "pix") && (
              <button
                onClick={goBack}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="size-4 text-white/50" />
              </button>
            )}
            <div className="size-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                {step === "plans"      && "Escolha seu plano"}
                {step === "method"     && "Forma de Pagamento"}
                {step === "processing" && "Iniciando pagamento…"}
                {step === "pix"        && "Pagamento via PIX"}
                {step === "success"    && "Plano adquirido!"}
              </DialogTitle>
              <p className="text-[11px] text-white/40 mt-0.5">
                Stars são creditados mensalmente e usados para manter integrações ativas
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Step: plan selection ─────────────────────────────────────────── */}
        {step === "plans" && (
          <div className="space-y-4 py-1">
            {plansLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-52 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <p className="text-center text-sm text-white/40 py-8">
                Nenhum plano disponível no momento.
              </p>
            ) : (
              <div className={cn(
                "grid gap-3",
                plans.length <= 2 ? "grid-cols-2" :
                plans.length === 3 ? "grid-cols-3" :
                "grid-cols-2 sm:grid-cols-3"
              )}>
                {plans.map((plan) => {
                  const isCurrent       = currentPlanSlug === plan.slug;
                  const isSelected      = selectedPlanId === plan.id;
                  const billingLabel    = BILLING_LABEL[plan.billingType] ?? "/mês";
                  const isFree          = plan.priceMonthly === 0;

                  return (
                    <button
                      key={plan.id}
                      disabled={isCurrent}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setStep("method");
                      }}
                      className={cn(
                        "relative flex flex-col rounded-xl border p-4 text-left transition-all",
                        isCurrent
                          ? "border-emerald-600/50 bg-emerald-950/20 opacity-70 cursor-not-allowed"
                          : isSelected
                          ? "border-[#7C3AED]/70 bg-[#7C3AED]/10"
                          : plan.highlighted
                          ? "border-[#7C3AED]/40 bg-[#7C3AED]/5 hover:border-[#7C3AED]/70"
                          : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/8"
                      )}
                    >
                      {/* Popular badge */}
                      {plan.highlighted && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="bg-[#7C3AED] text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow-lg">
                            Mais popular
                          </span>
                        </div>
                      )}
                      {/* Current plan badge */}
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                            Plano atual
                          </span>
                        </div>
                      )}

                      <p className="text-sm font-bold text-white text-center mb-2 mt-1">{plan.name}</p>

                      <div className="text-center mb-2">
                        {isFree ? (
                          <span className="text-xl font-extrabold text-emerald-400">Grátis</span>
                        ) : (
                          <>
                            <span className="text-[10px] text-white/50">R$</span>
                            <span className="text-2xl font-extrabold text-white mx-1 leading-none">
                              {plan.priceMonthly.toLocaleString("pt-BR")}
                            </span>
                            <span className="text-[10px] text-white/40">{billingLabel}</span>
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
                          {plan.maxUsers >= 999_999 ? "Ilimitados" : `Até ${plan.maxUsers}`} usuários
                        </span>
                      </div>

                      <div className={cn(
                        "w-full text-center text-[11px] font-bold py-1.5 rounded-lg mt-auto",
                        isCurrent
                          ? "bg-emerald-700/40 text-emerald-300"
                          : plan.highlighted
                          ? "bg-[#7C3AED]/80 text-white"
                          : "bg-white/10 text-white"
                      )}>
                        {isCurrent ? "Plano atual" : <><Zap className="inline size-3 mr-1" />Adquirir plano</>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-center text-[11px] text-white/25 pt-1">
              🔒 Pagamento seguro — cancele quando quiser, sem multas
            </p>
          </div>
        )}

        {/* ── Step: payment method ─────────────────────────────────────────── */}
        {step === "method" && (
          <div className="space-y-4 py-1">
            {/* Selected plan summary */}
            {selectedPlan && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-violet-400" />
                  <span className="text-sm font-semibold text-white">{selectedPlan.name}</span>
                  <span className="text-[11px] text-white/40">
                    {BILLING_LABEL[selectedPlan.billingType] ?? "/mês"}
                  </span>
                </div>
                <span className="font-bold text-white text-sm">
                  {selectedPlan.priceMonthly === 0
                    ? "Grátis"
                    : `R$ ${selectedPlan.priceMonthly.toLocaleString("pt-BR")}`}
                </span>
              </div>
            )}

            <p className="text-sm font-medium text-white">Como você prefere pagar?</p>

            {methodsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {methods.map((method) => {
                  const meta = METHOD_META[method.id as PaymentMethod];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => handleMethodSelect(method.id as PaymentMethod)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                        `border-border hover:${meta.activeBorder} hover:${meta.activeBg}`,
                      )}
                    >
                      <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", meta.bg)}>
                        <Icon className={cn("size-5", meta.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-white">{method.label}</p>
                          {method.isSandbox && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                              TESTE
                            </span>
                          )}
                          {meta.badge && (
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-medium",
                              method.id === "pix"
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                            )}>
                              {meta.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50">{method.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step: processing ────────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="py-10 flex flex-col items-center gap-4 text-center">
            <div className="size-14 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
              <Loader2 className="size-7 text-[#7C3AED] animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-white">
                {selectedMethod === "pix"
                  ? "Gerando QR Code PIX…"
                  : selectedMethod === "boleto"
                  ? "Gerando Boleto…"
                  : "Abrindo checkout seguro…"}
              </p>
              <p className="text-sm text-white/40 mt-1">
                {selectedMethod === "credit_card" ? "Você será redirecionado." : "Aguarde um instante."}
              </p>
            </div>
          </div>
        )}

        {/* ── Step: PIX inline ────────────────────────────────────────────── */}
        {step === "pix" && pixQrCode && (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
              <QrCode className="size-4 text-emerald-400 shrink-0" />
              <p className="text-[11px] text-emerald-300 leading-relaxed">
                Escaneie com o app do seu banco ou copie o código abaixo.
              </p>
            </div>

            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pixQrCode}`}
                alt="PIX QR Code"
                className="w-52 h-52 rounded-xl border border-white/10"
              />
            </div>

            {pixPayload && (
              <div className="relative">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono break-all text-white/40 max-h-16 overflow-hidden pr-16">
                  {pixPayload.slice(0, 80)}…
                </div>
                <button
                  onClick={copyPixCode}
                  className="absolute right-2 top-2 flex items-center gap-1 text-[11px] text-[#7C3AED] hover:text-[#a78bfa] font-medium"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            )}

            {checkoutUrl && (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2 text-sm border-white/10 text-white hover:bg-white/5">
                  <ExternalLink className="size-4" /> Abrir página de pagamento
                </Button>
              </a>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-blue-950/30 border border-blue-800/50 p-3">
              <Zap className="size-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-300 leading-relaxed">
                Seu plano será ativado automaticamente após a confirmação do pagamento.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: success ────────────────────────────────────────────────── */}
        {step === "success" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="size-16 rounded-full bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-emerald-300">Plano adquirido com sucesso!</p>
              <p className="text-sm text-white/40">Seu plano foi ativado.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
