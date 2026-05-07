import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import { PermissionsMatrix } from "@/features/admin/components/permissions-matrix";

const ALL_APPS = [
  "tracking", "chat", "forge", "spacetime", "nasa-planner",
  "insights", "integrations", "explorer", "nbox", "forge-contracts",
];

const ROLES = ["owner", "admin", "moderador", "member"];

export default async function PermissionsPage() {
  await requireAdminSession();

  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Matriz de Permissões</h1>
        <p className="text-sm text-zinc-400 mt-1">Configure permissões por empresa, função e aplicativo</p>
      </div>

      <PermissionsMatrix orgs={orgs} allApps={ALL_APPS} roles={ROLES} />
    </div>
  );
}
