"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Loader2, Sparkles, Zap, ChevronLeft,
  ExternalLink, Copy, Check, QrCode, CreditCard, FileText,
} from "lucide-react";
import { StarIcon } from "./star-icon";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "packages" | "method" | "processing" | "pix" | "success";
type PaymentMethod = "pix" | "credit_card" | "boleto";

interface StarsPurchaseModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Payment method display config ─────────────────────────────────────────────

const METHOD_META: Record<PaymentMethod, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  activeBorder: string;
  activeBg: string;
  badge?: string;
}> = {
  pix: {
    icon: QrCode,
    color:        "text-emerald-600 dark:text-emerald-400",
    bg:           "bg-emerald-50 dark:bg-emerald-900/30",
    border:       "border-emerald-200 dark:border-emerald-800/50",
    activeBorder: "border-emerald-500",
    activeBg:     "bg-emerald-50/80 dark:bg-emerald-900/20",
    badge:        "Instantâneo",
  },
  credit_card: {
    icon: CreditCard,
    color:        "text-violet-600 dark:text-violet-400",
    bg:           "bg-violet-50 dark:bg-violet-900/30",
    border:       "border-violet-200 dark:border-violet-800/50",
    activeBorder: "border-violet-500",
    activeBg:     "bg-violet-50/80 dark:bg-violet-900/20",
  },
  boleto: {
    icon: FileText,
    color:        "text-amber-600 dark:text-amber-400",
    bg:           "bg-amber-50 dark:bg-amber-900/30",
    border:       "border-amber-200 dark:border-amber-800/50",
    activeBorder: "border-amber-500",
    activeBg:     "bg-amber-50/80 dark:bg-amber-900/20",
    badge:        "3 dias úteis",
  },
};

// ── Modal ─────────────────────────────────────────────────────────────────────

export function StarsPurchaseModal({ open, onClose }: StarsPurchaseModalProps) {
  const queryClient = useQueryClient();

  const [step,           setStep]           = useState<Step>("packages");
  const [selectedPkg,    setSelectedPkg]    = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [copied,         setCopied]         = useState(false);

  // Payment result state
  const [pixQrCode,   setPixQrCode]   = useState<string | null>(null);
  const [pixPayload,  setPixPayload]  = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: packagesData, isLoading: pkgLoading } = useQuery({
    ...orpc.stars.listPackages.queryOptions(),
    enabled: open,
  });

  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    enabled: open,
  });

  const { data: methodsData, isLoading: methodsLoading } = useQuery({
    ...orpc.stars.listActiveGateways.queryOptions(),
    enabled: open,
  });

  // ── Direct purchase (no gateway configured — legacy) ─────────────────────────
  const { mutate: directPurchase, isPending: directPending } = useMutation({
    ...orpc.stars.purchasePackage.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(orpc.stars.getBalance.queryOptions());
      setStep("success");
      setTimeout(handleClose, 2500);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Gateway checkout ──────────────────────────────────────────────────────────
  const { mutate: gatewayCheckout, isPending: gwPending } = useMutation({
    ...orpc.stars.createGatewayCheckout.mutationOptions(),
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
    onError: (e) => {
      toast.error(e.message ?? "Erro ao iniciar pagamento.");
      setStep("method");
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("packages");
      setSelectedPkg(null);
      setSelectedMethod(null);
      setPixQrCode(null);
      setPixPayload(null);
      setCheckoutUrl(null);
    }, 300);
  };

  const packages    = packagesData?.packages   ?? [];
  const methods     = methodsData?.methods     ?? [];
  const balance     = balanceData?.balance     ?? 0;
  const hasGateways = methodsData?.hasGateways ?? false;

  const handleProceedWithPackage = () => {
    if (!selectedPkg) return;
    if (!hasGateways) {
      // Legacy: direct purchase without real payment
      directPurchase({ packageId: selectedPkg });
    } else {
      setStep("method");
    }
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep("processing");
    gatewayCheckout({ packageId: selectedPkg!, paymentMethod: method });
  };

  const copyPixCode = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goBack = () => {
    if (step === "method")  setStep("packages");
    if (step === "pix")     setStep("method");
  };

  const selectedPackage = packages.find((p) => p.id === selectedPkg);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(step === "method" || step === "pix") && (
              <button
                onClick={goBack}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="size-4 text-muted-foreground" />
              </button>
            )}
            <div className="size-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
              <StarIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {step === "packages"   && "Adquirir Stars"}
                {step === "method"     && "Forma de Pagamento"}
                {step === "processing" && "Iniciando pagamento…"}
                {step === "pix"        && "Pagamento via PIX"}
                {step === "success"    && "Stars adicionadas!"}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                Saldo atual: <strong>{balance.toLocaleString("pt-BR")} ★</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Step: packages ────────────────────────────────────────────────── */}
        {step === "packages" && (
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Stars não expiram. Use para ativar integrações e recursos premium.
            </p>

            {pkgLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg) => {
                  const isSelected   = selectedPkg === pkg.id;
                  const pricePerStar = (pkg.priceBrl / pkg.stars).toFixed(3);
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPkg(pkg.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                        isSelected
                          ? "border-[#7C3AED] bg-[#7C3AED]/5"
                          : "border-border hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5",
                      )}
                    >
                      <div className={cn(
                        "size-9 rounded-lg flex items-center justify-center shrink-0",
                        isSelected ? "bg-yellow-100 dark:bg-yellow-900/40" : "bg-muted",
                      )}>
                        <StarIcon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{pkg.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          R$ {pricePerStar}/★
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">
                          R$ {Number(pkg.priceBrl).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 dark:bg-blue-950/20 dark:border-blue-900/50">
              <Zap className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                Stars adquiridas nunca expiram. São cobradas mensalmente pelas integrações ativas.
              </p>
            </div>

            <Button
              onClick={handleProceedWithPackage}
              disabled={!selectedPkg || directPending}
              className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
            >
              {directPending ? (
                <><Loader2 className="size-4 animate-spin" /> Processando…</>
              ) : (
                <><Sparkles className="size-4" /> Escolher forma de pagamento</>
              )}
            </Button>
          </div>
        )}

        {/* ── Step: payment method selection ───────────────────────────────── */}
        {step === "method" && (
          <div className="space-y-4 py-1">
            {/* Package summary */}
            {selectedPackage && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2">
                  <StarIcon className="size-4" />
                  <span className="text-sm font-medium">{selectedPackage.label}</span>
                </div>
                <span className="font-bold text-sm">
                  R$ {Number(selectedPackage.priceBrl).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <p className="text-sm font-medium">Como você prefere pagar?</p>

            {methodsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {methods.map((method) => {
                  const meta = METHOD_META[method.id];
                  const Icon = meta.icon;
                  const isSelected = selectedMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => handleMethodSelect(method.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                        isSelected
                          ? `${meta.activeBorder} ${meta.activeBg}`
                          : `border-border hover:${meta.activeBorder} hover:${meta.activeBg}`,
                      )}
                    >
                      <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", meta.bg)}>
                        <Icon className={cn("size-5", meta.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{method.label}</p>
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
                        <p className="text-[11px] text-muted-foreground">{method.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step: processing ──────────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="py-10 flex flex-col items-center gap-4 text-center">
            <div className="size-14 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
              <Loader2 className="size-7 text-[#7C3AED] animate-spin" />
            </div>
            <div>
              <p className="font-semibold">
                {selectedMethod === "pix"
                  ? "Gerando QR Code PIX…"
                  : selectedMethod === "boleto"
                  ? "Gerando Boleto…"
                  : "Abrindo checkout seguro…"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedMethod === "credit_card"
                  ? "Você será redirecionado."
                  : "Aguarde um instante."}
              </p>
            </div>
          </div>
        )}

        {/* ── Step: PIX inline ──────────────────────────────────────────────── */}
        {step === "pix" && pixQrCode && (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50">
              <QrCode className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Escaneie com o app do seu banco ou copie o código abaixo.
              </p>
            </div>

            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pixQrCode}`}
                alt="PIX QR Code"
                className="w-52 h-52 rounded-xl border border-border"
              />
            </div>

            {pixPayload && (
              <div className="relative">
                <div className="p-3 rounded-xl bg-muted border border-border text-[10px] font-mono break-all text-muted-foreground max-h-16 overflow-hidden pr-16">
                  {pixPayload.slice(0, 80)}…
                </div>
                <button
                  onClick={copyPixCode}
                  className="absolute right-2 top-2 flex items-center gap-1 text-[11px] text-[#7C3AED] hover:text-[#6D28D9] font-medium"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            )}

            {checkoutUrl && (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <ExternalLink className="size-4" /> Abrir página de pagamento
                </Button>
              </a>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 dark:bg-blue-950/20 dark:border-blue-900/50">
              <Zap className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                As Stars serão creditadas automaticamente após a confirmação do pagamento.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: success ─────────────────────────────────────────────────── */}
        {step === "success" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-emerald-700">Stars adicionadas com sucesso!</p>
              <p className="text-sm text-muted-foreground">Seu saldo foi atualizado.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
