"use client";

import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Gift,
  Lock,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useStarFriendsMembers,
  useStarFriendsOverview,
  useStarFriendsRedemptions,
  useStarFriendsRewards,
} from "../hooks/use-star-friends";
import { describeSnapshot } from "../utils/labels";
import {
  TIER_LABELS,
  TIER_ORDER,
  tierMinStars,
  type LoyaltyTierId,
} from "../utils/tiers";
import { RedemptionActions } from "./redemption-actions";
import { TierPlanet } from "./tier-planet";

// Visão geral do /star-friends no estilo "app de fidelidade" (leiaute aprovado em 2026-09-29).

const TIER_CARD_STYLES: Record<LoyaltyTierId, string> = {
  EARTH: "bg-muted text-foreground",
  MOON: "bg-info/10 text-info",
  GALAXY: "bg-warning/10 text-warning",
};

const TIER_PHASES: Record<LoyaltyTierId, string> = {
  EARTH: "fase 1",
  MOON: "fase 2",
  GALAXY: "premium",
};

const MEMBERS_PREVIEW = 5;
const STAMP_PREVIEW = 10;

const STAR_PATH =
  "M16 3.5l3.6 7.3 8.1 1.2-5.85 5.7 1.4 8.05L16 21.95l-7.25 3.8 1.4-8.05L4.3 12l8.1-1.2z";

function StarAmount({
  value,
  className,
}: {
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold tabular-nums",
        className,
      )}
    >
      {value}
      <Star className="size-3.5 fill-current" aria-label="stars" />
    </span>
  );
}

function SectionCard({
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
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-[20px] border border-line bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actionLabel && onAction && (
          <Button
            type="button"
            variant="ghost"
            onClick={onAction}
            className="shrink-0 rounded-full text-info hover:text-info"
          >
            {actionLabel}
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function StarFriendsOverview({
  onNavigate,
}: {
  onNavigate: (tab: string) => void;
}) {
  const overview = useStarFriendsOverview();
  const rewards = useStarFriendsRewards();
  const members = useStarFriendsMembers("");
  const pendingRedemptions = useStarFriendsRedemptions("PENDING");
  const data = overview.data;
  if (!data?.program) return null;
  const { stats, program, tierCounts, recentEntries, deliveredByReward } = data;

  const heroStats = [
    {
      label: "Participantes",
      value: stats.membersCount,
      hint: "clientes no programa",
    },
    {
      label: "Stars em circulação",
      value: stats.starsInCirculation,
      hint: "saldo para trocar",
    },
    {
      label: "Resgates aguardando",
      value: stats.pendingRedemptions,
      hint: stats.pendingRedemptions ? "aprove abaixo" : "nada pendente",
    },
    {
      label: "Prêmios entregues",
      value: stats.deliveredRedemptions,
      hint: "desde o início",
    },
  ];
  const memberRows = (members.data?.pages ?? [])
    .flatMap((page) => page.members)
    .slice(0, MEMBERS_PREVIEW);
  const pending = pendingRedemptions.data?.redemptions ?? [];
  const rewardList = rewards.data?.rewards ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-[24px] bg-info p-4 text-white md:p-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.label} className="rounded-[18px] bg-white/15 p-3">
              <p className="truncate text-xs text-white/80">{stat.label}</p>
              <p className="mt-0.5 text-2xl font-extrabold tabular-nums md:text-3xl">
                {stat.value}
              </p>
              <p className="truncate text-[11px] text-white/70">{stat.hint}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white/10 py-2 pr-2 pl-4">
          <p className="text-xs font-semibold">
            Complete os cartões, suba de nível e troque por prêmios
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate("tiers")}
            className="shrink-0 rounded-full bg-background text-info hover:bg-background/90"
          >
            Ver regras
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Níveis dos clientes"
          description="Contam as stars ganhas na vida toda. Trocar prêmio não rebaixa."
          actionLabel="Regras"
          onAction={() => onNavigate("tiers")}
        >
          <div className="grid grid-cols-3 gap-2">
            {TIER_ORDER.map((tier) => {
              const count = tierCounts?.[tier] ?? 0;
              const minStars = tierMinStars(tier, program);
              return (
                <div
                  key={tier}
                  className={cn(
                    "flex min-w-0 flex-col gap-2 rounded-[18px] p-3",
                    TIER_CARD_STYLES[tier],
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-bold">
                      {TIER_LABELS[tier]}
                    </span>
                    <TierPlanet
                      tier={tier}
                      size={24}
                      className="shrink-0 md:size-8"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold tabular-nums">
                      {count}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {count === 1 ? "cliente" : "clientes"} ·{" "}
                      {TIER_PHASES[tier]}
                    </p>
                    <StarAmount
                      value={minStars === 0 ? "0" : `${minStars}+`}
                      className="mt-0.5 text-[11px] font-semibold text-muted-foreground"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Últimas movimentações"
          description="Tudo fica registrado: quem ganhou, trocou ou lançou stars."
          actionLabel="Histórico"
          onAction={() => onNavigate("history")}
        >
          {recentEntries.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem movimentações ainda.
            </p>
          )}
          <div className="flex flex-col">
            {recentEntries.map((entry) => {
              const isCredit = entry.stars > 0;
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      isCredit
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {isCredit ? (
                      <ArrowUp className="size-4" />
                    ) : (
                      <ArrowDown className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">
                      {entry.type === "REDEEM" ? "Troca: " : ""}
                      {entry.reason ?? describeSnapshot(entry.itemsSnapshot)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.memberName} ·{" "}
                      {format(new Date(entry.createdAt), "dd/MM HH:mm")}
                    </p>
                  </div>
                  <StarAmount
                    value={`${isCredit ? "+" : ""}${entry.stars}`}
                    className={cn(
                      "shrink-0 text-sm",
                      isCredit ? "text-success" : "text-destructive",
                    )}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Cartões e prêmios"
          description={`"Comprou X, ganhou Y": cada compra paga marca ${program.starsPerPurchase} ${program.starsPerPurchase === 1 ? "star" : "stars"}.`}
          actionLabel="Gerenciar"
          onAction={() => onNavigate("rewards")}
        >
          {rewardList.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum prêmio ainda. Crie o primeiro em Cartões e prêmios.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {rewardList.map((reward) => (
              <div
                key={reward.id}
                className={cn(
                  "flex min-w-0 flex-col gap-2 rounded-[18px] bg-muted p-3",
                  !reward.isActive && "opacity-60",
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-info/15 text-info">
                  <Gift className="size-4" />
                </span>
                <p className="line-clamp-2 text-sm leading-tight font-semibold">
                  {reward.name}
                </p>
                <div className="flex flex-wrap items-center gap-0.5">
                  {Array.from(
                    { length: Math.min(reward.costStars, STAMP_PREVIEW) },
                    (_, index) => (
                      <svg
                        key={index}
                        viewBox="0 0 32 32"
                        className="size-4"
                        aria-hidden
                      >
                        <path
                          d={STAR_PATH}
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                          className="fill-info/10 stroke-info"
                        />
                      </svg>
                    ),
                  )}
                  {reward.costStars > STAMP_PREVIEW && (
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      × {reward.costStars}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-warning">
                  {reward.costStars}{" "}
                  {reward.costStars === 1 ? "compra" : "compras"} ·{" "}
                  {reward.stock === null
                    ? "ilimitado"
                    : `${reward.stock} em estoque`}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {reward.minTier !== "EARTH" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 rounded-full bg-info/15 text-info"
                    >
                      <Lock className="size-3" /> {TIER_LABELS[reward.minTier]}+
                    </Badge>
                  )}
                  {!reward.isActive && (
                    <Badge variant="outline" className="rounded-full">
                      Inativo
                    </Badge>
                  )}
                  {deliveredByReward[reward.id] ? (
                    <span className="text-[11px] text-muted-foreground">
                      {deliveredByReward[reward.id]} entregue(s)
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard
            title="Participantes"
            description="Clientes e saldo para trocar."
            actionLabel="Ver todos"
            onAction={() => onNavigate("members")}
          >
            {memberRows.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Ninguém ainda: a primeira compra paga cria o participante.
              </p>
            )}
            <div className="flex flex-col">
              {memberRows.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 border-b border-line py-2 last:border-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info/15 text-xs font-bold text-info">
                    {member.name.trim().slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      •••• {member.phone.slice(-4)}
                    </p>
                  </div>
                  <StarAmount
                    value={member.balance}
                    className="shrink-0 text-sm text-warning"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Resgates aguardando"
            description="Aprove ou recuse as trocas pedidas pelo portal."
            actionLabel="Resgates"
            onAction={() => onNavigate("redemptions")}
          >
            {pending.length === 0 && (
              <p className="rounded-[18px] border border-dashed border-line p-3 text-center text-xs text-muted-foreground">
                Nada pendente.
              </p>
            )}
            {pending.map((redemption) => (
              <div
                key={redemption.id}
                className="flex flex-col gap-2 rounded-[18px] bg-muted p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {describeSnapshot(redemption.rewardSnapshot)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {redemption.member.name}
                    </p>
                  </div>
                  <StarAmount
                    value={redemption.costStars}
                    className="shrink-0 text-sm text-warning"
                  />
                </div>
                <RedemptionActions redemption={redemption} />
              </div>
            ))}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
