import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { APP_LABELS } from "@/lib/activity-constants";

const MAX_ROWS = 50_000;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return "";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const restMin = min - hr * 60;
  return restMin ? `${hr}h ${restMin}m` : `${hr}h`;
}

export async function GET(req: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const orgIdsRaw = url.searchParams.get("orgIds");
  const orgIdsParam = orgIdsRaw ? orgIdsRaw.split(",").filter(Boolean) : null;

  const memberships = await prisma.member.findMany({
    where: { userId: session.user.id },
    select: { organizationId: true, role: true },
  });
  const myOrgIds = memberships.map((m) => m.organizationId);
  const orgIds = orgIdsParam && orgIdsParam.length > 0
    ? orgIdsParam.filter((id) => myOrgIds.includes(id))
    : myOrgIds;

  if (orgIds.length === 0) {
    return new Response("No organizations", { status: 403 });
  }

  const isMemberOnly = memberships.every((m) => m.role === "member");
  const where: any = {
    organizationId: { in: orgIds },
  };
  if (isMemberOnly) where.userId = session.user.id;
  else if (userId) where.userId = userId;
  if (appSlug) where.appSlug = appSlug;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

  const logs = await prisma.systemActivityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      organizationId: true,
      userName: true,
      userEmail: true,
      appSlug: true,
      subAppSlug: true,
      featureKey: true,
      actionLabel: true,
      durationMs: true,
      createdAt: true,
    },
  });

  const lines: string[] = [];
  lines.push(
    [
      "Nome",
      "Email",
      "Empresa",
      "App",
      "Funcionalidade",
      "O que fez",
      "Tempo",
      "Data",
    ]
      .map(csvEscape)
      .join(","),
  );

  for (const l of logs) {
    lines.push(
      [
        l.userName,
        l.userEmail,
        orgNameById.get(l.organizationId) ?? l.organizationId,
        APP_LABELS[l.appSlug] ?? l.appSlug,
        l.featureKey ?? l.subAppSlug ?? "",
        l.actionLabel,
        formatDuration(l.durationMs),
        l.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = "\uFEFF" + lines.join("\n");
  const filename = `atividades_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
