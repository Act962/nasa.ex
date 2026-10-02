import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import prisma from "@/lib/prisma";
import {
  getProgramSettings,
  getCommissionRateForTier,
  getDiscountRateForTier,
  getThresholdForTier,
  decideTierByActiveReferrals,
  currentCycleYearMonth,
  nextPayoutDate,
  TIER_ORDER,
} from "@/features/partner/lib/partner-service";
import {
  Handshake,
  TrendingUp,
  Users,
  ShoppingBag,
  AlertTriangle,
  Copy,
  Wallet,
  Sparkles,
} from "lucide-react";
import { ReferralLinkCard } from "@/features/partner/components/referral-link-card";

const TIER_BADGE_CLASS: Record<string, string> = {
  SUITE: "bg-muted text-foreground",
  EARTH: "bg-temp-cold/15 text-temp-cold",
  GALAXY: "bg-temp-warm/15 text-temp-warm",
  CONSTELLATION: "bg-temp-hot/15 text-temp-hot",
  INFINITY: "bg-temp-very-hot/15 text-temp-very-hot",
};

export default async function PartnerDashboardPage() {
  const { user, partner } = await requirePartnerSession();
  const settings = await getProgramSettings();

  // Link de indicação
  const link = await prisma.partnerReferralLink.findUnique({
    where: { userId: user.id },
  });

  // Counts atuais
  const [activeReferrals, atRiskReferrals, inactiveReferrals] =
    await Promise.all([
      prisma.partnerReferral.count({
        where: { partnerUserId: user.id, activityStatus: "ACTIVE" },
      }),
      prisma.partnerReferral.count({
        where: { partnerUserId: user.id, activityStatus: "AT_RISK" },
      }),
      prisma.partnerReferral.count({
        where: { partnerUserId: user.id, activityStatus: "INACTIVE" },
      }),
    ]);

  // Próximo tier
  const idx = partner.tier ? TIER_ORDER.indexOf(partner.tier) : -1;
  const nextTier =
    idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
  const nextThreshold = nextTier
    ? getThresholdForTier(nextTier, settings)
    : null;

  // Ciclo atual
  const cycle = currentCycleYearMonth();
  const cycleStart = new Date(`${cycle}-01T00:00:00.000Z`);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + 1);

  const [pendingAgg, pendingPurchasesAgg] = await Promise.all([
    prisma.partnerCommission.aggregate({
      where: {
        partnerId: partner.id,
        cycleYearMonth: cycle,
        status: { in: ["PENDING", "READY"] },
      },
      _sum: { commissionBrl: true, basePaymentBrl: true },
      _count: { _all: true },
    }),
    prisma.partnerStarPurchase.aggregate({
      where: {
        partnerId: partner.id,
        createdAt: { gte: cycleStart, lt: cycleEnd },
      },
      _sum: {
        originalPriceBrl: true,
        paidPriceBrl: true,
        savingsBrl: true,
      },
    }),
  ]);

  const referralRevenueBrl = Number(pendingAgg._sum.basePaymentBrl ?? 0);
  const grossCommissionBrl = Number(pendingAgg._sum.commissionBrl ?? 0);
  const commissionRate = partner.tier
    ? getCommissionRateForTier(partner.tier, settings)
    : 0;
  const discountRate = partner.tier
    ? getDiscountRateForTier(partner.tier, settings)
    : 0;
  const partnerOriginalBrl = Number(pendingPurchasesAgg._sum.originalPriceBrl ?? 0);
  const partnerPaidBrl = Number(pendingPurchasesAgg._sum.paidPriceBrl ?? 0);
  const partnerSavingsBrl = Number(pendingPurchasesAgg._sum.savingsBrl ?? 0);
  const scheduledPayoutDate = nextPayoutDate(cycle, settings.payoutDayOfMonth);

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Handshake className="w-5 h-5 text-muted-foreground" />
            Bem-vindo de volta, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nível atual:{" "}
            <span
              className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                partner.tier ? TIER_BADGE_CLASS[partner.tier] : "text-muted-foreground"
              }`}
            >
              {partner.tier ?? "—"}
            </span>{" "}
            ·{" "}
            <span className="text-foreground">
              {activeReferrals} org(s) ativa(s)
            </span>
          </p>
        </div>
        {nextTier && nextThreshold && (
          <div className="text-right text-xs text-muted-foreground">
            <div className="text-muted-foreground uppercase tracking-wider mb-0.5">
              Próximo nível
            </div>
            <div className="text-foreground font-semibold">
              {nextTier} — faltam{" "}
              {Math.max(nextThreshold - activeReferrals, 0)} org(s)
            </div>
          </div>
        )}
      </div>

      {/* Carência */}
      {partner.gracePeriodEndsAt && (
        <div className="bg-warning/15 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div className="text-sm text-warning">
            <p className="font-semibold">
              Atenção: você está em período de carência até{" "}
              {new Date(partner.gracePeriodEndsAt).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-warning mt-1">
              Se não recuperar orgs ativas, cairá de{" "}
              {partner.gracePeriodFromTier} para {partner.gracePeriodToTier}.
              Engaje empresas em risco para preservar seu nível.
            </p>
          </div>
        </div>
      )}

      {/* Cards do ciclo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card
          icon={ShoppingBag}
          accent="text-info"
          label="Compras das indicadas"
          value={`R$ ${fmt(referralRevenueBrl)}`}
          sub={`${pendingAgg._count._all} compra(s) — ${cycle}`}
        />
        <Card
          icon={TrendingUp}
          accent="text-success"
          label={`Comissão (${commissionRate}%)`}
          value={`R$ ${fmt(grossCommissionBrl)}`}
          sub="Bruto a receber"
        />
        <Card
          icon={Sparkles}
          accent="text-info"
          label={`Suas compras (${discountRate}% off)`}
          value={`R$ ${fmt(partnerPaidBrl)}`}
          sub={`Economizou R$ ${fmt(partnerSavingsBrl)}`}
        />
        <Card
          icon={Wallet}
          accent="text-warning"
          label="A receber em"
          value={scheduledPayoutDate.toLocaleDateString("pt-BR")}
          sub={`R$ ${fmt(grossCommissionBrl)} líquido`}
          highlight
        />
      </div>

      {/* Distribuição de orgs */}
      <div className="bg-card border border-line rounded-xl p-5">
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Suas indicações
            </h2>
          </div>
          <a
            href="/partner/indicacoes"
            className="text-xs text-info hover:underline"
          >
            Ver todas →
          </a>
        </header>
        <div className="grid grid-cols-3 gap-3">
          <Pill
            color="bg-success/15 border-success/40"
            label="Ativas"
            value={activeReferrals}
            note="contam para nível"
          />
          <Pill
            color="bg-warning/15 border-warning/40"
            label="Em risco"
            value={atRiskReferrals}
            note="≤ 14 dias para inativar"
          />
          <Pill
            color="bg-muted border-line"
            label="Inativas"
            value={inactiveReferrals}
            note="não contam para nível"
          />
        </div>
      </div>

      {/* Link de indicação */}
      {link && (
        <ReferralLinkCard
          code={link.code}
          visits={link.visits}
          signups={link.signups}
        />
      )}

      {/* Vitalício */}
      <div className="bg-card border border-line rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Acumulado vitalício</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Field
            label="Receita das indicadas"
            value={`R$ ${fmt(Number(partner.totalReferralRevenueBrl))}`}
          />
          <Field
            label="Total ganho"
            value={`R$ ${fmt(Number(partner.totalEarnedBrl))}`}
            accent="text-success"
          />
          <Field
            label="Total pago"
            value={`R$ ${fmt(Number(partner.totalPaidBrl))}`}
          />
          <Field
            label="Economia em compras"
            value={`R$ ${fmt(Number(partner.totalSavingsBrl))}`}
            accent="text-info"
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        highlight
          ? "bg-warning/15 border-warning/30"
          : "bg-card border-line"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ?? "text-muted-foreground"}`} />
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
      </div>
      <div className={`text-lg font-bold ${accent ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Pill({
  color,
  label,
  value,
  note,
}: {
  color: string;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{note}</div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-base font-semibold mt-1 ${accent ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
