import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import { ShieldCheck } from "lucide-react";
import { AdminModeratorsList } from "@/features/admin/components/admin-moderators-list";

export default async function ModeratorsPage() {
  await requireAdminSession();

  const admins = await prisma.user.findMany({
    where: { isSystemAdmin: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, email: true, image: true, createdAt: true,
      members: { take: 1, select: { organization: { select: { name: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-info" /> Moderadores do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {admins.length} usuário(s) com acesso administrativo ao sistema
        </p>
      </div>

      <AdminModeratorsList admins={admins} />
    </div>
  );
}
