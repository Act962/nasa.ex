"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { StarIcon } from "./star-icon";

const ITEMS = [
  {
    q: "O que são Stars (★)?",
    a: "Stars são a moeda interna da plataforma NASA. Você usa Stars para ativar e manter integrações com ferramentas externas (WhatsApp, CRMs, plataformas de anúncios etc.).",
  },
  {
    q: "Como ganho Stars?",
    a: "Seu plano creditia Stars automaticamente todo mês. Você também pode comprar pacotes de top-up a qualquer momento — esses nunca expiram.",
  },
  {
    q: "O que acontece se meu saldo zerar?",
    a: "Integrações que dependem de Stars são pausadas automaticamente. Basta recarregar o saldo para reativá-las sem perder configurações.",
  },
  {
    q: "Stars expiram?",
    a: "Stars do ciclo mensal têm rollover de até 30% para o mês seguinte. Stars compradas via top-up nunca expiram.",
  },
];

export function StarsLearnCard({ className }: { className?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-linear-to-r from-yellow-50 to-yellow-50/30 dark:from-yellow-950/20 dark:to-transparent border-b flex items-center gap-2">
        <div className="size-7 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
          <StarIcon className="size-3.5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Como funcionam as ★ Stars</p>
          <p className="text-[11px] text-muted-foreground">
            Moeda interna da plataforma NASA
          </p>
        </div>
      </div>

      {/* Plans summary */}
      <div className="px-4 py-3 border-b">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">
          Planos disponíveis
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              name: "Earth",
              stars: "500 ★",
              price: "R$ 149/mês",
              users: "3 usuários",
            },
            {
              name: "Explore",
              stars: "2.000 ★",
              price: "R$ 399/mês",
              users: "10 usuários",
            },
            {
              name: "Constellation",
              stars: "Ilimitado",
              price: "Sob consulta",
              users: "Ilimitado",
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className="rounded-lg bg-muted/40 p-2 text-center space-y-0.5"
            >
              <p className="text-[11px] font-semibold">{plan.name}</p>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold flex items-center justify-center gap-0.5">
                <StarIcon className="size-2.5" />
                {plan.stars}
              </p>
              <p className="text-[10px] text-muted-foreground">{plan.price}</p>
              <p className="text-[10px] text-muted-foreground">{plan.users}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top-up packages */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="size-3 text-[#7C3AED]" />
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
            Top-ups (nunca expiram)
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { stars: "100 ★", price: "R$ 19" },
            { stars: "500 ★", price: "R$ 79" },
            { stars: "1.000 ★", price: "R$ 139" },
          ].map((pkg) => (
            <div
              key={pkg.stars}
              className="rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800 p-2 text-center"
            >
              <p className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400 flex items-center justify-center gap-0.5">
                <StarIcon className="size-2.5" />
                {pkg.stars.replace(" ★", "")}
              </p>
              <p className="text-[10px] text-muted-foreground">{pkg.price}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="divide-y">
        {ITEMS.map((item, i) => (
          <button
            key={i}
            className="w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-muted/30 transition-colors"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{item.q}</p>
              {openIdx === i && (
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {item.a}
                </p>
              )}
            </div>
            {openIdx === i ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
