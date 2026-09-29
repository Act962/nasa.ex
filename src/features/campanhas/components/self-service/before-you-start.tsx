"use client";

import Link from "next/link";
import { BadgeCheck, CreditCard, Gift, Languages, ShieldCheck, TrendingUp, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BroadcastCostSimulator } from "./broadcast-cost-simulator";
import { RequestTeamHelp } from "./request-team-help";
import { STARS_FRIENDS_PRESET_ID } from "../../lib/template-presets";

interface RuleCard {
  icon: LucideIcon;
  title: string;
  text: string;
}

const RULES: RuleCard[] = [
  {
    icon: CreditCard,
    title: "Quem cobra as mensagens",
    text: "A Meta cobra direto no cartão cadastrado na sua conta, por mensagem entregue. A ÓRBITA cobra só a taxa de serviço da campanha.",
  },
  {
    icon: Gift,
    title: "O que é grátis",
    text: "Responder quem te chamou nas últimas 24h. Até 30/09/2026, Utilidade dentro dessa janela também. Quem vem de anúncio Click-to-WhatsApp abre 72h grátis.",
  },
  {
    icon: BadgeCheck,
    title: "Utilidade custa ~9x menos",
    text: "Utilidade é informação da conta do cliente (saldo, pedido, pontos). Oferta, cupom ou \"renove\" viram Marketing — a Meta reclassifica sozinha.",
  },
  {
    icon: TrendingUp,
    title: "Número novo não dispara para a base toda",
    text: "A Meta libera volume aos poucos: 250 contatos/dia, depois 2.000, 10.000, 100.000 e ilimitado. Campanhas maiores saem em lotes diários automáticos.",
  },
  {
    icon: ShieldCheck,
    title: "Qualidade e opt-in",
    text: "Só envie para quem autorizou. Muitos bloqueios derrubam a qualidade do número e reduzem o limite diário.",
  },
  {
    icon: Languages,
    title: "Fatura em reais",
    text: "Desde 01/07/2026 a conta pode faturar em BRL. A migração é obrigatória até 30/06/2027.",
  },
];

/** "Antes de começar" (spec 0040, RF-1/RF-2): regras da Meta, simulador e modelo de Utilidade. */
export function BeforeYouStart({ trackingId, currentLimitTier }: { trackingId?: string | null; currentLimitTier?: string | null }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RULES.map((rule, index) => (
          <div
            key={rule.title}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-xl border p-3"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <rule.icon className="mb-2 size-5 text-emerald-600" />
            <p className="text-sm font-medium">{rule.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rule.text}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Simule sua campanha</p>
        <BroadcastCostSimulator currentLimitTier={currentLimitTier} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 sm:flex-row sm:items-center">
        <Wand2 className="size-6 shrink-0 text-emerald-600" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Recomendação: comece por Utilidade</p>
          <p className="text-muted-foreground">
            Modelo pronto avisando o cliente do saldo STARS FRIENDS, com botão para o seu canal de atendimento na ÓRBITA.
          </p>
        </div>
        {trackingId ? (
          <Button asChild size="sm">
            <Link href={`/campanhas/templates/new?trackingId=${trackingId}&preset=${STARS_FRIENDS_PRESET_ID}`}>Usar modelo</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Conecte um número para usar o modelo.</p>
        )}
      </div>

      <div className="flex justify-end">
        <RequestTeamHelp step="Antes de começar" />
      </div>
    </div>
  );
}
