import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdminSession();
    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(Number(searchParams.get("limit")  ?? "50"), 200);
    const offset = Number(searchParams.get("offset") ?? "0");
    const userId = searchParams.get("userId") ?? undefined;
    const appSlug = searchParams.get("appSlug") ?? undefined;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (userId)  where.userId  = userId;
    if (appSlug) where.appSlug = appSlug;

    const [logs, total] = await Promise.all([
      prisma.systemActivityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.systemActivityLog.count({ where }),
    ]);

    // Org permission logs (legacy)
    const orgLogs = !appSlug || appSlug === "permissions"
      ? await prisma.orgActivityLog.findMany({
          where: { organizationId: orgId, ...(userId ? { userId } : {}) },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    const normalizedOrgLogs = orgLogs.map((l) => ({
      id: l.id,
      organizationId: l.organizationId,
      userId: l.userId,
      userName: l.userName,
      userEmail: l.userEmail,
      userImage: null as string | null,
      appSlug: "permissions",
      action: l.action,
      actionLabel: formatOrgAction(l.action, l.resource),
      resource: l.resource ?? null,
      resourceId: l.resourceId ?? null,
      metadata: l.metadata,
      createdAt: l.createdAt,
    }));

    const merged = [...logs.map((l) => ({ ...l, userImage: l.userImage ?? null })), ...normalizedOrgLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ logs: merged, total: total + orgLogs.length });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

function formatOrgAction(action: string, resource?: string | null): string {
  const map: Record<string, string> = {
    member_added:       `Adicionou membro ${resource ?? ""}`,
    member_removed:     `Removeu membro ${resource ?? ""}`,
    role_changed:       `Alterou cargo de ${resource ?? ""}`,
    permission_updated: `Atualizou permissão: ${resource ?? ""}`,
  };
  return map[action] ?? action;
}
