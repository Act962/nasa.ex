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
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-400" />
            Bem-vindo de volta, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Nível atual:{" "}
            <span className="text-amber-300 font-semibold">
              {partner.tier ?? "—"}
            </span>{" "}
            ·{" "}
            <span className="text-zinc-300">
              {activeReferrals} org(s) ativa(s)
            </span>
          </p>
        </div>
        {nextTier && nextThreshold && (
          <div className="text-right text-xs text-zinc-400">
            <div className="text-zinc-500 uppercase tracking-wider mb-0.5">
              Próximo nível
            </div>
            <div className="text-amber-300 font-semibold">
              {nextTier} — faltam{" "}
              {Math.max(nextThreshold - activeReferrals, 0)} org(s)
            </div>
          </div>
        )}
      </div>

      {/* Carência */}
      {partner.gracePeriodEndsAt && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold">
              Atenção: você está em período de carência até{" "}
              {new Date(partner.gracePeriodEndsAt).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-amber-300/80 mt-1">
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
          accent="text-blue-300"
          label="Compras das indicadas"
          value={`R$ ${fmt(referralRevenueBrl)}`}
          sub={`${pendingAgg._count._all} compra(s) — ${cycle}`}
        />
        <Card
          icon={TrendingUp}
          accent="text-emerald-300"
          label={`Comissão (${commissionRate}%)`}
          value={`R$ ${fmt(grossCommissionBrl)}`}
          sub="Bruto a receber"
        />
        <Card
          icon={Sparkles}
          accent="text-purple-300"
          label={`Suas compras (${discountRate}% off)`}
          value={`R$ ${fmt(partnerPaidBrl)}`}
          sub={`Economizou R$ ${fmt(partnerSavingsBrl)}`}
        />
        <Card
          icon={Wallet}
          accent="text-amber-300"
          label="A receber em"
          value={scheduledPayoutDate.toLocaleDateString("pt-BR")}
          sub={`R$ ${fmt(grossCommissionBrl)} líquido`}
          highlight
        />
      </div>

      {/* Distribuição de orgs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              Suas indicações
            </h2>
          </div>
          <a
            href="/partner/indicacoes"
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            Ver todas →
          </a>
        </header>
        <div className="grid grid-cols-3 gap-3">
          <Pill
            color="bg-emerald-500/15 border-emerald-500/40"
            label="Ativas"
            value={activeReferrals}
            note="contam para nível"
          />
          <Pill
            color="bg-amber-500/15 border-amber-500/40"
            label="Em risco"
            value={atRiskReferrals}
            note="≤ 14 dias para inativar"
          />
          <Pill
            color="bg-zinc-700/40 border-zinc-700"
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-semibold text-white">Acumulado vitalício</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Field
            label="Receita das indicadas"
            value={`R$ ${fmt(Number(partner.totalReferralRevenueBrl))}`}
          />
          <Field
            label="Total ganho"
            value={`R$ ${fmt(Number(partner.totalEarnedBrl))}`}
            accent="text-emerald-300"
          />
          <Field
            label="Total pago"
            value={`R$ ${fmt(Number(partner.totalPaidBrl))}`}
          />
          <Field
            label="Economia em compras"
            value={`R$ ${fmt(Number(partner.totalSavingsBrl))}`}
            accent="text-purple-300"
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
          ? "bg-amber-500/10 border-amber-500/40"
          : "bg-zinc-900 border-zinc-800"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ?? "text-zinc-400"}`} />
        <div className="text-xs text-zinc-400 uppercase tracking-wide">
          {label}
        </div>
      </div>
      <div className={`text-lg font-bold ${accent ?? "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1">{sub}</div>}
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
      <div className="text-xs text-zinc-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      <div className="text-[11px] text-zinc-400 mt-1">{note}</div>
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
      <div className="text-[11px] text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-base font-semibold mt-1 ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
