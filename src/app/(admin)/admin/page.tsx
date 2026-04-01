import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import { Building2, Users, Star, Activity, TrendingUp, Wifi } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireAdminSession();

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [
    totalOrgs,
    totalUsers,
    onlineNow,
    starsAgg,
    topOrgs,
    recentTransactions,
    planDist,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.userPresence.count({ where: { lastSeenAt: { gte: fiveMinutesAgo } } }),
    prisma.organization.aggregate({ _sum: { starsBalance: true } }),
    prisma.organization.findMany({
      orderBy: { starsBalance: "desc" },
      take: 8,
      select: {
        id: true, name: true, slug: true, starsBalance: true,
        plan: { select: { name: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.starTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, type: true, amount: true, description: true, createdAt: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.plan.findMany({
      select: { name: true, _count: { select: { organizations: true } } },
    }),
  ]);

  const stats = [
    { label: "Empresas", value: totalOrgs.toLocaleString("pt-BR"), icon: Building2, color: "text-blue-400" },
    { label: "Usuários", value: totalUsers.toLocaleString("pt-BR"), icon: Users, color: "text-emerald-400" },
    { label: "Online agora", value: onlineNow.toLocaleString("pt-BR"), icon: Wifi, color: "text-green-400" },
    { label: "Stars em circulação", value: (starsAgg._sum.starsBalance ?? 0).toLocaleString("pt-BR"), icon: Star, color: "text-yellow-400" },
  ];

  const txTypeLabel: Record<string, string> = {
    PLAN_CREDIT: "Crédito Plano",
    TOPUP_PURCHASE: "Recarga",
    APP_CHARGE: "Cobrança App",
    APP_SETUP: "Setup App",
    ROLLOVER: "Rollover",
    MANUAL_ADJUST: "Ajuste Manual",
    REFUND: "Reembolso",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Visão geral do sistema NASA.ex</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-500 font-medium">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" /> Distribuição por Plano
        </h2>
        <div className="flex flex-wrap gap-3">
          {planDist.map((p) => (
            <div key={p.name} className="bg-zinc-800 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-zinc-400">{p.name}</p>
              <p className="text-lg font-bold text-white">{p._count.organizations}</p>
            </div>
          ))}
          <div className="bg-zinc-800 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-zinc-400">Sem plano</p>
            <p className="text-lg font-bold text-white">
              {totalOrgs - planDist.reduce((s, p) => s + p._count.organizations, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top companies */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" /> Top Empresas por Stars
          </h2>
          <div className="space-y-2">
            {topOrgs.map((org) => (
              <Link
                key={org.id}
                href={`/admin/companies/${org.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-800 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">
                    {org.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {org.plan?.name ?? "Sem plano"} · {org._count.members} membro(s)
                  </p>
                </div>
                <span className="text-xs font-semibold text-yellow-400">
                  {org.starsBalance.toLocaleString("pt-BR")} ⭐
                </span>
              </Link>
            ))}
          </div>
          <Link href="/admin/companies" className="block text-center text-xs text-violet-400 hover:text-violet-300 mt-4 transition-colors">
            Ver todas →
          </Link>
        </div>

        {/* Recent transactions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" /> Transações Recentes
          </h2>
          <div className="space-y-2">
            {recentTransactions.map((tx) => {
              const isCredit = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-800 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tx.organization.name}</p>
                    <p className="text-[11px] text-zinc-500">{txTypeLabel[tx.type] ?? tx.type} · {tx.description.slice(0, 40)}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ml-3 ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
                    {isCredit ? "+" : ""}{tx.amount.toLocaleString("pt-BR")} ⭐
                  </span>
                </div>
              );
            })}
          </div>
          <Link href="/admin/stars" className="block text-center text-xs text-violet-400 hover:text-violet-300 mt-4 transition-colors">
            Ver histórico completo →
          </Link>
        </div>
      </div>
    </div>
  );
}
