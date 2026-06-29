import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminUserPanel } from "@/features/admin/components/admin-user-panel";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { adminUser } = await requireAdminSession();
  const { userId } = await params;

  const [user, plans, allLevels] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, image: true,
        nickname: true, isSystemAdmin: true, isActive: true, createdAt: true,
        members: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, role: true, cargo: true, organizationId: true,
            organization: {
              select: {
                id: true, name: true, logo: true,
                starsBalance: true, planId: true,
                plan: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
      select: { id: true, name: true, monthlyStars: true, priceMonthly: true },
    }),
    prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!user) notFound();

  // Build per-org space point data
  const orgIds = user.members.map((m) => m.organizationId);
  const spacePoints = await prisma.userSpacePoint.findMany({
    where: { userId, orgId: { in: orgIds } },
    select: { orgId: true, totalPoints: true },
  });
  const spMap = Object.fromEntries(spacePoints.map((sp) => [sp.orgId, sp.totalPoints]));

  const orgs = user.members.map((m) => {
    const pts = spMap[m.organizationId] ?? 0;
    const earned = allLevels.filter((l) => l.requiredPoints <= pts);
    const lvl = earned[earned.length - 1] ?? null;
    return {
      memberId:        m.id,
      orgId:           m.organizationId,
      orgName:         m.organization.name,
      orgLogo:         m.organization.logo,
      role:            m.role,
      cargo:           m.cargo,
      starsBalance:    m.organization.starsBalance,
      planId:          m.organization.planId,
      planName:        m.organization.plan?.name ?? null,
      spacePoints:     pts,
      spaceLevelName:  lvl?.name ?? null,
      spaceLevelEmoji: lvl?.planetEmoji ?? null,
    };
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          {user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-zinc-700" />
          )}
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {user.name}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {user.isActive ? "Ativo" : "Inativo"}
              </span>
            </h1>
            <p className="text-sm text-zinc-400">{user.email}</p>
          </div>
        </div>
      </div>

      <AdminUserPanel
        userId={user.id}
        name={user.name}
        email={user.email}
        image={user.image}
        nickname={user.nickname}
        isSystemAdmin={user.isSystemAdmin}
        isActive={user.isActive}
        createdAt={user.createdAt.toISOString()}
        isSelf={userId === adminUser.id}
        orgs={orgs}
        plans={plans.map((p) => ({ ...p, priceMonthly: Number(p.priceMonthly) }))}
      />
    </div>
  );
}
