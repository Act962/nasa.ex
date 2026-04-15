import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import { SpacePointsAdminClient } from "@/features/admin/components/space-points/space-points-admin-client";
import { Rocket, Users, Zap, Building2 } from "lucide-react";

export default async function AdminSpacePointsPage() {
  await requireAdminSession();

  // ── Server-side overview ───────────────────────────────────────────────────
  const [totalUsers, totalPointsAgg, orgGroups] = await Promise.all([
    prisma.userSpacePoint.count(),
    prisma.userSpacePoint.aggregate({ _sum: { totalPoints: true } }),
    prisma.userSpacePoint.groupBy({
      by: ["orgId"],
      _sum: { totalPoints: true },
      _count: { userId: true },
      orderBy: { _sum: { totalPoints: "desc" } },
      take: 20,
    }),
  ]);

  const orgIds = orgGroups.map((o) => o.orgId);
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, slug: true, logo: true },
  });
  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o]));

  // All orgs for selector
  const allOrgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
    take: 200,
  });

  const topOrgs = orgGroups.map((o) => ({
    orgId: o.orgId,
    orgName: orgMap[o.orgId]?.name ?? "–",
    orgLogo: orgMap[o.orgId]?.logo ?? null,
    totalPoints: o._sum.totalPoints ?? 0,
    userCount: o._count.userId,
  }));

  const stats = {
    totalUsers,
    totalPointsAwarded: totalPointsAgg._sum.totalPoints ?? 0,
    activeOrgs: orgGroups.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Space Points</h1>
          <p className="text-sm text-zinc-400">
            Controle de gamificação por empresa e usuário
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: Users,
            label: "Usuários ativos",
            value: stats.totalUsers.toLocaleString("pt-BR"),
            color: "text-violet-400",
          },
          {
            icon: Zap,
            label: "Pontos distribuídos",
            value: stats.totalPointsAwarded.toLocaleString("pt-BR") + " pts",
            color: "text-yellow-400",
          },
          {
            icon: Building2,
            label: "Empresas com pontos",
            value: stats.activeOrgs.toString(),
            color: "text-cyan-400",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3"
          >
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className="text-xs text-zinc-400">{label}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Client interactive section */}
      <SpacePointsAdminClient topOrgs={topOrgs} allOrgs={allOrgs} />
    </div>
  );
}
