import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Star,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ShieldCheck,
} from "lucide-react";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
          referralLink: { select: { code: true, signups: true, visits: true } },
        },
      },
    },
  });
  if (!partner) notFound();

  const [referrals, commissions, payouts, tierHistory, acceptances] =
    await Promise.all([
      prisma.partnerReferral.findMany({
        where: { partnerUserId: partner.userId },
        include: {
          referredOrganization: { select: { id: true, name: true, slug: true } },
          attachedByAdmin: { select: { id: true, name: true } },
        },
        orderBy: { signedUpAt: "desc" },
        take: 50,
      }),
      prisma.partnerCommission.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          organization: { select: { name: true } },
        },
      }),
      prisma.partnerPayout.findMany({
        where: { partnerId: partner.id },
        orderBy: { scheduledFor: "desc" },
        take: 12,
      }),
      prisma.partnerTierHistory.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.partnerTermsAcceptance.findMany({
        where: { partnerId: partner.id },
        include: {
          termsVersion: { select: { version: true, title: true } },
        },
        orderBy: { acceptedAt: "desc" },
      }),
    ]);

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/partners"
          className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Voltar para Parceiros
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center">
          {partner.user.image ? (
            <img
              src={partner.user.image}
              alt={partner.user.name}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <span className="text-base font-semibold text-zinc-200">
              {partner.user.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{partner.user.name}</h1>
          <p className="text-sm text-zinc-400">{partner.user.email}</p>
          <p className="text-xs text-zinc-500 mt-1">
            Partner desde{" "}
            {new Date(partner.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">
            Nível atual
          </div>
          <div className="text-lg font-bold text-amber-400">
            {partner.tier ?? "—"}
          </div>
          {partner.manualTierOverride && (
            <span className="text-[10px] text-amber-400">
              nível travado pelo admin
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Stat
          label="Total ganho"
          value={`R$ ${fmt(Number(partner.totalEarnedBrl))}`}
          accent="text-emerald-400"
        />
        <Stat
          label="Total pago"
          value={`R$ ${fmt(Number(partner.totalPaidBrl))}`}
          accent="text-zinc-200"
        />
        <Stat
          label="Receita das indicadas"
          value={`R$ ${fmt(Number(partner.totalReferralRevenueBrl))}`}
          accent="text-blue-400"
        />
        <Stat
          label="Economia em compras"
          value={`R$ ${fmt(Number(partner.totalSavingsBrl))}`}
          accent="text-purple-400"
        />
      </div>

      {/* Carência */}
      {partner.gracePeriodEndsAt && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold">
              Em período de carência até{" "}
              {new Date(partner.gracePeriodEndsAt).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-amber-300/80 mt-1">
              Cairá de {partner.gracePeriodFromTier} para{" "}
              {partner.gracePeriodToTier} se não recuperar orgs ativas.
            </p>
          </div>
        </div>
      )}

      {/* Referrals */}
      <Section
        title="Empresas indicadas"
        subtitle={`${referrals.length} indicação(ões) (mostrando 50 mais recentes)`}
        icon={Building2}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2">Empresa</th>
              <th className="text-left px-4 py-2">Origem</th>
              <th className="text-left px-4 py-2">Atividade</th>
              <th className="text-right px-4 py-2">Compras (R$)</th>
              <th className="text-right px-4 py-2">Stars consumidos</th>
              <th className="text-right px-4 py-2">Cadastrada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {referrals.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-800/40">
                <td className="px-4 py-2 text-white">
                  {r.referredOrganization.name}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.source === "admin_manual" ? (
                    <span className="text-amber-300">
                      manual{" "}
                      {r.attachedByAdmin?.name &&
                        `(${r.attachedByAdmin.name})`}
                    </span>
                  ) : (
                    <span className="text-zinc-400">link</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <ActivityBadge status={r.activityStatus} />
                </td>
                <td className="px-4 py-2 text-right text-zinc-300">
                  R$ {fmt(Number(r.totalPurchasedBrl))}
                </td>
                <td className="px-4 py-2 text-right text-yellow-400">
                  {r.totalStarsConsumed.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2 text-right text-zinc-500 text-xs">
                  {new Date(r.signedUpAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-zinc-500 text-sm"
                >
                  Nenhuma indicação registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Comissões e Payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Comissões recentes"
          subtitle={`${commissions.length} (últimas 25)`}
          icon={Star}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                <th className="text-left px-4 py-2">Org</th>
                <th className="text-left px-4 py-2">Ciclo</th>
                <th className="text-right px-4 py-2">Valor</th>
                <th className="text-right px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {commissions.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-800/40">
                  <td className="px-4 py-2 text-white">
                    {c.organization.name}
                  </td>
                  <td className="px-4 py-2 text-zinc-400 text-xs">
                    {c.cycleYearMonth}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-400">
                    R$ {fmt(Number(c.commissionBrl))}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {c.status}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    Sem comissões.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        <Section
          title="Payouts"
          subtitle={`${payouts.length} ciclo(s) fechado(s)`}
          icon={TrendingUp}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                <th className="text-left px-4 py-2">Ciclo</th>
                <th className="text-left px-4 py-2">Pago em</th>
                <th className="text-right px-4 py-2">Bruto</th>
                <th className="text-right px-4 py-2">Líquido</th>
                <th className="text-right px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-800/40">
                  <td className="px-4 py-2 text-white">{p.cycleYearMonth}</td>
                  <td className="px-4 py-2 text-zinc-400 text-xs">
                    {p.paidAt
                      ? new Date(p.paidAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300">
                    R$ {fmt(Number(p.grossBrl))}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-400 font-semibold">
                    R$ {fmt(Number(p.netBrl))}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">{p.status}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Sem payouts ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>

      {/* Tier history e Aceites */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Histórico de níveis"
          subtitle="Últimas mudanças"
          icon={Calendar}
        >
          <ul className="text-sm divide-y divide-zinc-800">
            {tierHistory.map((h) => (
              <li key={h.id} className="px-4 py-3 flex justify-between gap-3">
                <div>
                  <div className="text-zinc-200">
                    {h.fromTier ?? "—"} → {h.toTier ?? "—"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {h.reason} · {h.activeReferrals} ativas
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </li>
            ))}
            {tierHistory.length === 0 && (
              <li className="px-4 py-6 text-center text-zinc-500 text-sm">
                Sem mudanças registradas.
              </li>
            )}
          </ul>
        </Section>

        <Section
          title="Aceites de termos"
          subtitle="Auditoria LGPD"
          icon={ShieldCheck}
        >
          <ul className="text-sm divide-y divide-zinc-800">
            {acceptances.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex justify-between">
                  <div className="text-zinc-200">
                    v{a.termsVersion.version} — {a.termsVersion.title}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(a.acceptedAt).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  IP: {a.ipAddress ?? "—"} · hash: {a.contentHashAtTime.slice(0, 12)}…
                </div>
              </li>
            ))}
            {acceptances.length === 0 && (
              <li className="px-4 py-6 text-center text-zinc-500 text-sm">
                Sem aceites registrados.
              </li>
            )}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-[11px] text-zinc-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-lg font-semibold mt-1 ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <header className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-amber-400" />}
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ActivityBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-300",
    AT_RISK: "bg-amber-500/20 text-amber-300",
    INACTIVE: "bg-zinc-700 text-zinc-300",
  };
  const lbl: Record<string, string> = {
    ACTIVE: "Ativa",
    AT_RISK: "Em risco",
    INACTIVE: "Inativa",
  };
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] ?? ""}`}
    >
      {lbl[status] ?? status}
    </span>
  );
}
