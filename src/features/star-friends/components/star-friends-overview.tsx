"use client";

import { format } from "date-fns";
import { ArrowDown, ArrowUp, Gift, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStarFriendsMembers, useStarFriendsOverview, useStarFriendsRedemptions, useStarFriendsRewards } from "../hooks/use-star-friends";
import { describeSnapshot } from "../utils/labels";
import { TIER_LABELS, TIER_ORDER, tierMinStars, type LoyaltyTierId } from "../utils/tiers";
import { RedemptionActions } from "./redemption-actions";
import { TierPlanet } from "./tier-planet";

// Visão geral do /star-friends no estilo "app de fidelidade" (leiaute aprovado em 2026-09-29).

const TIER_CARD_GRADIENTS: Record<LoyaltyTierId, string> = {
  EARTH: "from-[#1e6fd9] to-[#2bb673]",
  MOON: "from-[#6b7385] to-[#c9ced9]",
  GALAXY: "from-[#3b0764] to-[#a21caf]",
};

const TIER_PHASES: Record<LoyaltyTierId, string> = { EARTH: "fase 1", MOON: "fase 2", GALAXY: "premium" };

const MEMBERS_PREVIEW = 5;
const STAMP_PREVIEW = 10;

const STAR_PATH = "M16 3.5l3.6 7.3 8.1 1.2-5.85 5.7 1.4 8.05L16 21.95l-7.25 3.8 1.4-8.05L4.3 12l8.1-1.2z";

function Panel({
  title,
  description,
  actionLabel,
  onAction,
  children,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function StarFriendsOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const overview = useStarFriendsOverview();
  const rewards = useStarFriendsRewards();
  const members = useStarFriendsMembers("");
  const pendingRedemptions = useStarFriendsRedemptions("PENDING");
  const data = overview.data;
  if (!data?.program) return null;
  const { stats, program, tierCounts, recentEntries, deliveredByReward } = data;

  const heroStats = [
    { label: "Participantes", value: stats.membersCount, hint: "clientes no programa" },
    { label: "⭐ em circulação", value: stats.starsInCirculation, hint: "saldo para trocar" },
    { label: "Resgates aguardando", value: stats.pendingRedemptions, hint: stats.pendingRedemptions ? "aprove abaixo" : "nada pendente" },
    { label: "Prêmios entregues", value: stats.deliveredRedemptions, hint: "desde o início" },
  ];
  const memberRows = (members.data?.pages ?? []).flatMap((page) => page.members).slice(0, MEMBERS_PREVIEW);
  const pending = pendingRedemptions.data?.redemptions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-primary to-blue-500 p-5 text-white">
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(1.5px_1.5px_at_12%_30%,#fff9,transparent),radial-gradient(1px_1px_at_30%_70%,#fff8,transparent),radial-gradient(1.5px_1.5px_at_62%_22%,#fffa,transparent),radial-gradient(1px_1px_at_82%_64%,#fff8,transparent)]" />
        <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs text-blue-100">{stat.label}</p>
              <p className="mt-1 text-3xl font-extrabold">{stat.value}</p>
              <p className="text-[11px] text-blue-200">{stat.hint}</p>
            </div>
          ))}
        </div>
        <div className="relative mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
          <p className="text-xs font-bold tracking-wide uppercase">Complete os cartões · suba de nível · troque por prêmios</p>
          <button
            type="button"
            onClick={() => onNavigate("tiers")}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-primary"
          >
            Ver regras
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Níveis dos clientes"
          description="Contam as ⭐ ganhas na vida toda. Trocar prêmio não rebaixa."
          actionLabel="Níveis e regras"
          onAction={() => onNavigate("tiers")}
        >
          <div className="grid grid-cols-3 gap-3">
            {TIER_ORDER.map((tier) => {
              const count = tierCounts?.[tier] ?? 0;
              const minStars = tierMinStars(tier, program);
              return (
                <div
                  key={tier}
                  className={cn("flex min-h-36 flex-col justify-between rounded-2xl bg-gradient-to-br p-4 text-white", TIER_CARD_GRADIENTS[tier])}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{TIER_LABELS[tier]}</span>
                    <TierPlanet tier={tier} size={32} />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold">{count}</p>
                    <p className="text-[11px] opacity-90">
                      {count === 1 ? "cliente" : "clientes"} · {TIER_PHASES[tier]} · {minStars === 0 ? "0 ⭐" : `a partir de ${minStars} ⭐`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="relative mx-2 mt-2 flex justify-between">
            <span className="absolute top-2 right-3 left-3 h-0.5 bg-primary" />
            {TIER_ORDER.map((tier) => (
              <div key={tier} className="relative flex flex-col items-center text-xs text-muted-foreground">
                <span className="size-4 rounded-full border-2 border-primary bg-background" />
                <span className="mt-1 font-bold text-foreground">{tierMinStars(tier, program)}</span>
                {TIER_LABELS[tier]}
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Últimas movimentações"
          description="Tudo fica registrado: quem ganhou, trocou ou lançou ⭐."
          actionLabel="Histórico"
          onAction={() => onNavigate("history")}
        >
          {recentEntries.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem movimentações ainda.</p>}
          <div className="flex flex-col">
            {recentEntries.map((entry) => {
              const isCredit = entry.stars > 0;
              return (
                <div key={entry.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      isCredit ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500",
                    )}
                  >
                    {isCredit ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">
                      {entry.type === "REDEEM" ? "Troca: " : ""}
                      {entry.reason ?? describeSnapshot(entry.itemsSnapshot)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.memberName} · {format(new Date(entry.createdAt), "dd/MM HH:mm")}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold", isCredit ? "text-emerald-500" : "text-red-500")}>
                    {isCredit ? "+" : ""}
                    {entry.stars} ⭐
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Cartões e prêmios"
          description={`"Comprou X, ganhou Y": cada compra paga marca ${program.starsPerPurchase} ⭐.`}
          actionLabel="Gerenciar"
          onAction={() => onNavigate("rewards")}
        >
          {(rewards.data?.rewards ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum prêmio ainda. Crie o primeiro em Cartões e prêmios.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(rewards.data?.rewards ?? []).map((reward) => (
              <div key={reward.id} className={cn("flex flex-col gap-2 rounded-2xl border bg-muted/20 p-3.5", !reward.isActive && "opacity-60")}>
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Gift className="size-4" />
                </span>
                <p className="text-sm leading-tight font-semibold">{reward.name}</p>
                <div className="flex flex-wrap items-center gap-0.5">
                  {Array.from({ length: Math.min(reward.costStars, STAMP_PREVIEW) }, (_, index) => (
                    <svg key={index} viewBox="0 0 32 32" className="size-5" aria-hidden>
                      <path d={STAR_PATH} strokeWidth="2.2" strokeLinejoin="round" className="fill-primary/10 stroke-blue-400" />
                    </svg>
                  ))}
                  {reward.costStars > STAMP_PREVIEW && <span className="ml-1 text-[11px] text-muted-foreground">× {reward.costStars}</span>}
                </div>
                <p className="text-[11px] font-semibold text-amber-500">
                  {reward.costStars} {reward.costStars === 1 ? "compra" : "compras"} ·{" "}
                  {reward.stock === null ? "ilimitado" : `${reward.stock} em estoque`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {reward.minTier !== "EARTH" && (
                    <Badge variant="secondary" className="gap-1 bg-violet-500/15 text-violet-300">
                      <Lock className="size-3" /> só {TIER_LABELS[reward.minTier]} e acima
                    </Badge>
                  )}
                  {!reward.isActive && <Badge variant="outline">Inativo</Badge>}
                  {deliveredByReward[reward.id] ? (
                    <span className="text-[11px] text-muted-foreground">{deliveredByReward[reward.id]} entregue(s)</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Participantes" description="Clientes e saldo para trocar." actionLabel="Ver todos" onAction={() => onNavigate("members")}>
          {memberRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Ninguém ainda: a primeira compra paga cria o participante.</p>}
          {memberRows.map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-blue-200">
                {member.name.trim().slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{member.name}</p>
                <p className="text-xs text-muted-foreground">•••• {member.phone.slice(-4)}</p>
              </div>
              <span className="text-sm font-bold text-amber-500">{member.balance} ⭐</span>
            </div>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Resgates aguardando aprovação</p>
            {pending.length === 0 && <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">Nada pendente.</p>}
            {pending.map((redemption) => (
              <div key={redemption.id} className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
                <p className="font-medium">
                  {describeSnapshot(redemption.rewardSnapshot)} · {redemption.costStars} ⭐
                </p>
                <p className="text-xs text-muted-foreground">{redemption.member.name}</p>
                <RedemptionActions redemption={redemption} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
