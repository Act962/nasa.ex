"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Star, Users, CheckCircle2,
  ChevronDown, ChevronUp, ArrowRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Shared type ─────────────────────────────────────────────────────────────

export interface PlanDetail {
  id:           string;
  name:         string;
  slogan?:      string | null;
  price:        number;
  priceLabel?:  string | null;
  stars:        number;
  rollover:     number;
  highlighted:  boolean;
  badge?:       string | null;
  benefits:     string[];
  ctaLabel:     string;
  ctaHref?:     string | null;
  starPerUser?: number;
  planSlug?:    string; // slug usado para pré-selecionar no PlanPurchaseModal
}

const DEFAULT_STAR_PER_USER = 30;

// ─── Modal ────────────────────────────────────────────────────────────────────

export function PlanDetailModal({
  plan,
  open,
  onClose,
  isLoggedIn,
  isCurrentPlan,
  onPurchase,
}: {
  plan:           PlanDetail | null;
  open:           boolean;
  onClose:        () => void;
  isLoggedIn?:    boolean;
  isCurrentPlan?: boolean;
  onPurchase?:    () => void;
}) {
  const [showBenefits, setShowBenefits] = useState(true);

  if (!plan) return null;

  const spu = plan.starPerUser ?? DEFAULT_STAR_PER_USER;
  const isFree = plan.price === 0;

  const accentClass = plan.highlighted
    ? "border-info/50 bg-popover shadow-[0_0_80px_color-mix(in_oklch,var(--info)_30%,transparent)]"
    : isFree
    ? "border-success/30 bg-popover"
    : "border-line bg-popover";

  const isExternalCta = !!plan.ctaHref && /^(https?:|mailto:|tel:)/i.test(plan.ctaHref);

  const ctaClass = plan.highlighted
    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
    : isFree
    ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
    : "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-line";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Remove default DialogContent padding/styles */}
      <DialogContent className="max-w-sm p-0 bg-transparent border-0 shadow-none overflow-visible [&>button]:hidden">
        {/* Accessible title (visually hidden) */}
        <DialogTitle className="sr-only">Detalhes do plano {plan.name}</DialogTitle>

        {/* Card */}
        <div className={cn("relative flex flex-col rounded-2xl border p-6 space-y-4", accentClass)}>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-foreground/6 hover:bg-foreground/12 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {/* Top badge */}
          {plan.badge && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <span className={cn(
                "text-[11px] font-black px-4 py-1.5 rounded-full whitespace-nowrap uppercase tracking-wider",
                plan.highlighted
                  ? "bg-info text-white shadow-lg shadow-info/40"
                  : "bg-warning text-black",
              )}>
                {plan.badge}
              </span>
            </div>
          )}

          {/* Name + price row */}
          <div className="flex items-start justify-between gap-3 pt-2">
            <div>
              <h3 className="font-black text-foreground text-2xl leading-tight">{plan.name}</h3>
              {plan.highlighted && (
                <span className="inline-block mt-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-info/15 text-info border border-info/30">
                  ⭐ Destaque
                </span>
              )}
              {plan.slogan && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[180px]">
                  {plan.slogan}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {plan.priceLabel ? (
                <>
                  <p
                    className={cn(
                      "text-2xl font-black",
                      isFree ? "text-success" : "text-foreground",
                    )}
                  >
                    {plan.priceLabel}
                  </p>
                  {!isFree && (
                    <p className="text-[11px] text-muted-foreground">por mês</p>
                  )}
                </>
              ) : isFree ? (
                <p className="text-2xl font-black text-success">Grátis</p>
              ) : (
                <>
                  <p className="text-2xl font-black text-foreground">
                    R$ {plan.price.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">por mês</p>
                </>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Stars */}
            <div className="flex flex-col items-center p-3 rounded-xl bg-foreground/5 border border-line gap-0.5">
              <Star className="w-4 h-4 text-warning" />
              <span className="font-bold text-foreground text-sm leading-tight">
                {plan.stars === 0
                  ? "—"
                  : plan.stars >= 1000
                  ? `${plan.stars / 1000}K`
                  : plan.stars}
              </span>
              <span className="text-muted-foreground text-[9px]">Stars/mês</span>
            </div>
            {/* Per user */}
            <div className="flex flex-col items-center p-3 rounded-xl bg-info/10 border border-info/20 gap-0.5">
              <Users className="w-4 h-4 text-info" />
              <span className="font-bold text-info text-sm leading-tight">{spu}★</span>
              <span className="text-info/50 text-[9px]">por usuário</span>
            </div>
            {/* Rollover */}
            <div className="flex flex-col items-center p-3 rounded-xl bg-foreground/5 border border-line gap-0.5">
              <span className="text-[18px] leading-none">🔁</span>
              <span className="font-bold text-foreground text-sm leading-tight">{plan.rollover}%</span>
              <span className="text-muted-foreground text-[9px]">Rollover</span>
            </div>
          </div>

          {/* Unlimited users pill */}
          <div className="flex items-center gap-2 bg-info/8 border border-info/20 rounded-xl px-3.5 py-2.5">
            <Users className="size-3.5 text-info shrink-0" />
            <span className="text-info text-xs font-medium">
              Usuários ilimitados — {spu}★ por usuário/mês
            </span>
          </div>

          {/* Benefits collapsible */}
          {plan.benefits.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowBenefits(!showBenefits)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showBenefits
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
                {plan.benefits.length} benefício(s) incluídos
              </button>
              {showBenefits && (
                <ul className="space-y-2">
                  {plan.benefits.map((b, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex items-start gap-2 text-xs",
                        b.startsWith("Tudo do")
                          ? "text-muted-foreground font-semibold mt-1"
                          : "text-muted-foreground",
                      )}
                    >
                      {b.startsWith("Tudo do") ? (
                        <ChevronUp className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                      )}
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-line" />

          {/* CTA */}
          {isLoggedIn && isCurrentPlan && !isExternalCta ? (
            <Button disabled className={cn("w-full font-bold text-sm rounded-2xl py-5 opacity-60", ctaClass)}>
              Plano atual
            </Button>
          ) : isLoggedIn ? (
            <Button
              onClick={() => { onClose(); onPurchase?.(); }}
              className={cn("w-full font-bold text-sm rounded-2xl py-5", ctaClass)}
            >
              {isExternalCta ? plan.ctaLabel : "Adquirir plano"}
              <ArrowRight className="size-4 ml-2" />
            </Button>
          ) : (
            <Button asChild className={cn("w-full font-bold text-sm rounded-2xl py-5", ctaClass)}>
              <Link
                href={plan.ctaHref ?? "/sign-up"}
                target={isExternalCta && plan.ctaHref?.startsWith("http") ? "_blank" : undefined}
                rel={isExternalCta && plan.ctaHref?.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {plan.ctaLabel}
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
