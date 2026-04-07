import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import { NotificationCenterV2 } from "@/features/admin/components/notification-center-v2";

export default async function NotificationsPage() {
  await requireAdminSession();

  const [notifications, total, orgs] = await Promise.all([
    prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true, title: true, body: true, type: true,
        targetType: true, targetId: true, createdBy: true, createdAt: true,
        _count: { select: { reads: true } },
      },
    }),
    prisma.adminNotification.count(),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Central de Notificações</h1>
        <p className="text-sm text-zinc-400 mt-1">{total} notificações enviadas</p>
      </div>

      <NotificationCenterV2
        notifications={notifications.map((n) => ({
          ...n,
          targetId: n.targetId ?? null,
          createdAt: n.createdAt.toISOString(),
          readCount: n._count.reads,
        }))}
        orgs={orgs}
      />
    </div>
  );
}
